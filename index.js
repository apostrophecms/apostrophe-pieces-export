const stringify = require('csv-stringify');
const _ = require('lodash');
const fs = require('fs');
const Promise = require('bluebird');

module.exports = {
  improve: 'apostrophe-pieces',

  afterConstruct: function(self) {
    // Make sure it's enabled for this particular subclass of pieces
    if (!self.options.export) {
      return setImmediate(callback);
    }
    self.exportAddRoutes();
    self.exportPushAssets();
    self.exportPushDefineRelatedTypes();
  },

  construct: function(self, options) {

    self.exportFormats = {
      csv: {
        label: 'CSV (comma-separated values)',
        output: function(filename) {
          return stringify({}).pipe(fs.createWriteStream(filename));
        }
      },
      tsv: {
        label: 'TSV (tab-separated values)',
        output: function(filename) {
          return stringify({ delimiter: '\t' }).pipe(fs.createWriteStream(filename));
        }
      },
      xlsx: require('./lib/excel.js')(self)
    };

    // See README for requirements to implement a new format

    self.exportAddFormat = function(name, format) {
      self.exportFormats[name] = format;
    };

    self.exportAddRoutes = function() {
      self.route('post', 'export', function(req, res) {
        var draftOrLive = self.apos.launder.string(req.body.draftOrLive);
        var extension = self.apos.launder.string(req.body.format);
        if (!self.exportFormats[format]) {
          return res.send({ status: 'invalid' });
        }
        var format = self.exportFormats[extension];
        self.apos.modules['apostrophe-jobs'].runNonBatch(req,
          doTheWork,
          {
            label: 'Exporting ' + self.pluralLabel
          }
        );
        function doTheWork(req, reporting, callback) {
          var filename = self.apos.attachments.uploadfs.getTempPath() + '/' + self.apos.utils.generateId() + '-export.' + extension;
          let out;
          let data;
          let reported = false;
          if (format.output.length === 1) {
            // Now kick off the stream processing
            out = job.format.output(filename);
            out.on('error', function(err) {
              reported = true;
              return callback(err);
            });
            out.on('close', function() {
              if (!reported) {
                return callback(null);
              }
            });
          } else {
            // Create a simple writable stream that just buffers
            // up the objects. Allows the simpler type of output function
            // to drive the same methods that otherwise write to an output
            // stream
            data = [];
            out = {
              write: function(o) {
                data.push(o);
              },
              end: function() {
                return format.output(filename, data, function(err) {
                  if (err) {
                    out.emit('error', err);
                  }
                  out.emit('close');
                });
              },
              on: function(name, fn) {
                out.listeners[name] = out.listeners[name] || [];
                out.listeners[name].push(fn);
              },
              emit: function(name, v) {
                (out.listeners[name] || []).forEach(function(fn) {
                  fn(v);
                });
              },
              listeners: []
            };
          }

          const lastId = '';
          return nextBatch(callback);
          function nextBatch(callback) {
            return self.find(req).sort({ _id: 1 }).and({ _id: { $gt: lastId } }).limit(100).toArray(function(err, batch) {
              if (err) {
                return callback(err);
              }
              if (!batch.length) {
                return close(callback);
              }
              lastId = batch[batch.length - 1]._id;
              return async.eachSeries(batch, function(piece, callback) {
                const record = {};
                return self.exportRecord(req, piece, record, callback);
              }, function(err) {
                if (err) {
                  return callback(err);
                }
                return nextBatch(callback);
              });
            });
          }
          function close(callback) {
            out.end();
            return callback(err);
          }
        }
      });
    };

    self.exportRecord = function(req, piece, record, callback) {
      const schema = self.schema;
      // Schemas don't have built-in exporters, for strings or otherwise.
      // Follow a format that reverses well if fed back to our importer
      // (although the importer can't accept an attachment via URL yet,
      // that is a plausible upgrade). Export schema fields only,
      // plus _id.
      record._id = piece._id;
      _.each(schema, function(field) {
        const value = piece[field.name];
        if ((typeof value) === 'object') {
          if (field.type.match(/^joinByArray/)) {
            value = (value || []).map(function(item) {
              return item.title;
            }).join(',');
          } else if (field.type.match(/^joinByOne/)) {
            value = value ? value.title || '';
          } else if (field.type === 'attachment') {
            value = self.apos.attachments.url(value);
          } else {
            value = '';
          }
        } else {
          if (value) {
            value = value.toString();
          }
          record[field.name] = value;
        }
        record[field.name] = value;
      });
      return setImmediate(callback);
    };

    self.importPushDefineRelatedTypes = function() {
      self.apos.push.browserMirrorCall('user', self, { 'tool': 'export-modal', stop: 'apostrophe-pieces' });
    };

    self.importPushAssets = function() {
      self.pushAsset('script', 'export-modal', { when: 'user' });
    };

  }
};
