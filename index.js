const stringify = require('csv-stringify');
const _ = require('lodash');
const fs = require('fs');
const async = require('async');

module.exports = {
  improve: 'apostrophe-pieces',

  afterConstruct: function (self) {
    // Make sure it's enabled for this particular subclass of pieces
    if (!self.options.export) {
      return;
    }
    self.exportAddRoutes();
    self.exportPushAssets();
    self.exportPushDefineRelatedTypes();
  },

  construct: function (self, options) {
    if (options.export) {
      self.exportFormats = {
        csv: {
          label: 'CSV (comma-separated values)',
          output: function (filename) {
            const out = stringify({ header: true });
            out.pipe(fs.createWriteStream(filename));
            return out;
          }
        },
        tsv: {
          label: 'TSV (tab-separated values)',
          output: function (filename) {
            const out = stringify({ header: true, delimiter: '\t' });
            out.pipe(fs.createWriteStream(filename));
            return out;
          }
        },
        xlsx: require('./lib/excel.js')(self)
      };

      let superGetManagerControls = self.getManagerControls;
      self.getManagerControls = function (req) {
        let controls = _.clone(superGetManagerControls(req));
        const addIndex = _.findIndex(controls, function (control) {
          return control.action.match(/^(upload|create)/);
        });
        let control = {
          type: 'minor',
          label: 'Export',
          action: 'export-' + self.apos.utils.cssName(self.name)
        };
        if (addIndex >= 0) {
          controls.splice(addIndex, 0, control);
        } else {
          controls.push(control);
        }
        return controls;
      };

      // See README for requirements to implement a new format

      self.exportAddFormat = function (name, format) {
        self.exportFormats[name] = format;
      };

      self.exportAddRoutes = function () {
        self.route('post', 'export-modal', function (req, res) {
          return res.send(self.render(req, 'exportModal', {
            options: {
              label: self.label,
              pluralLabel: self.pluralLabel,
              name: self.name
            },
            exportFormats: self.exportFormats
          }));
        });

        self.route('post', 'export', function (req, res) {
          let draftOrLive = self.apos.launder.string(req.body.draftOrLive);
          let extension = self.apos.launder.string(req.body.extension);
          if (!self.exportFormats[extension]) {
            return res.send({ status: 'invalid' });
          }
          let format = self.exportFormats[extension];
          self.apos.modules['apostrophe-jobs'].runNonBatch(
            req,
            function (req, reporting, callback) {
              return self.exportRun(req, reporting, {
                draftOrLive: draftOrLive,
                extension: extension,
                format: format
              }, callback);
            },
            {
              labels: {
                title: 'Exporting ' + self.pluralLabel,
                completed: 'Completed — click "Done" to download'
              }
            }
          );
        });

        self.exportRun = function (req, reporting, options, callback) {
          const draftOrLive = options.draftOrLive;
          const extension = options.extension;
          const format = options.format;
          let filename = self.apos.attachments.uploadfs.getTempPath() + '/' + self.apos.utils.generateId() + '-export.' + extension;
          let out;
          let data;
          let reported = false;

          if (draftOrLive === 'live') {
            // Hack to fetch the live docs
            req.locale = req.locale.replace(/-draft$/, '');
          }

          if (format.output.length === 1) {
            // Now kick off the stream processing
            out = format.output(filename);
          } else {
            // Create a simple writable stream that just buffers
            // up the objects. Allows the simpler type of output function
            // to drive the same methods that otherwise write to an output
            // stream
            data = [];
            out = {
              write: function (o) {
                data.push(o);
              },
              end: function () {
                return format.output(filename, data, function (err) {
                  if (err) {
                    out.emit('error', err);
                  } else {
                    out.emit('finish');
                  }
                });
              },
              on: function (name, fn) {
                out.listeners[name] = out.listeners[name] || [];
                out.listeners[name].push(fn);
              },
              emit: function (name, v) {
                (out.listeners[name] || []).forEach(function (fn) {
                  fn(v);
                });
              },
              listeners: {}
            };
          }

          out.on('error', function (err) {
            if (!reported) {
              reported = true;
              cleanup();
              return callback(err);
            }
          });
          out.on('finish', function () {
            if (!reported) {
              reported = true;
              // Must copy it to uploadfs, the server that created it
              // and the server that delivers it might be different
              const downloadPath = '/exports/' + self.apos.utils.generateId() + '.' + extension;
              return self.apos.attachments.uploadfs.copyIn(filename, downloadPath, function (err) {
                if (err) {
                  cleanup();
                  return callback(err);
                }
                reporting.setResults({
                  url: self.apos.attachments.uploadfs.getUrl() + downloadPath
                });
                cleanup();
                // Report is available for one hour
                setTimeout(function () {
                  self.apos.attachments.uploadfs.remove(downloadPath, function (err) {
                    if (err) {
                      self.apos.utils.error(err);
                    }
                  });
                }, options.expiration || 1000 * 60 * 60);
                return callback(null);
              });
            }
          });

          let lastId = '';
          nextBatch(callback);

          // work around a bug in apostrophe (fixed in newer apostrophe):
          // it tests for a `then` property on the return value without
          // first making sure it is at least an object
          return {};

          function nextBatch (callback) {
            return self.find(req).sort({ _id: 1 }).and({ _id: { $gt: lastId } }).limit(options.batchSize || 100).toArray(function (err, batch) {
              if (err) {
                return callback(err);
              }
              if (!batch.length) {
                return close();
              }
              lastId = batch[batch.length - 1]._id;
              return async.eachSeries(batch, function (piece, callback) {
                let record = {};
                return self.exportRecord(req, piece, record, function (err) {
                  if (err) {
                    reporting.bad();
                  } else {
                    reporting.good();
                  }
                  out.write(record);
                  return callback(null);
                });
              }, function (err) {
                if (err) {
                  return callback(err);
                }
                return nextBatch(callback);
              });
            });
          }
          function close() {
            out.end();
          }
          function cleanup () {
            try {
              fs.unlinkSync(filename);
            } catch (e) {
              self.apos.utils.error(e);
            }
          }
        };
      };

      self.exportRecord = function (req, piece, record, callback) {
        const schema = self.schema;
        // Schemas don't have built-in exporters, for strings or otherwise.
        // Follow a format that reverses well if fed back to our importer
        // (although the importer can't accept an attachment via URL yet,
        // that is a plausible upgrade). Export schema fields only,
        // plus _id.
        record._id = piece._id;
        schema.forEach(function (field) {
          let value = piece[field.name];
          if ((typeof value) === 'object') {
            if (field.type.match(/^joinByArray/)) {
              value = (value || []).map(function (item) {
                return item.title;
              }).join(',');
            } else if (field.type.match(/^joinByOne/)) {
              value = value ? value.title : '';
            } else if (field.type === 'attachment') {
              value = self.apos.attachments.url(value);
            } else if ((field.type === 'area') || (field.type === 'singleton')) {
              value = self.apos.areas.richText(value);
            } else {
              value = '';
            }
          } else {
            if (value) {
              value = value.toString();
            }
          }
          record[field.name] = value;
        });
        return setImmediate(function() {
          return self.beforeExport(req, piece, record, callback);
        });
      };

      // For your overriding convenience

      self.beforeExport = function(req, piece, record, callback) {
        return callback(null);
      };

      self.exportPushDefineRelatedTypes = function () {
        self.apos.push.browserMirrorCall('user', self, { 'tool': 'export-modal', stop: 'apostrophe-pieces' });
      };

      self.exportPushAssets = function () {
        self.pushAsset('script', 'export-modal', { when: 'user' });
      };
    }
  }
};
