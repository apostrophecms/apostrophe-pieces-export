var assert = require('assert');
var _ = require('lodash');
var request = require('request');

describe('apostrophe-pieces-export', function () {
  var apos;

  this.timeout(5000);

  after(function (done) {
    require('apostrophe/test-lib/util').destroy(apos, done);
  });

  it('should initialize apostrophe', function (done) {
    apos = require('apostrophe')({
      testModule: true,
      baseUrl: 'http://localhost:7780',
      modules: {
        'apostrophe-express': {
          port: 7780
        },

        'apostrophe-pieces-export': {},

        'products': {
          extend: 'apostrophe-pieces',
          name: 'product',
          export: true
        }
      },
      afterInit: function (callback) {
        assert(apos.modules.products);
        assert(apos.modules.products.options.export);
        return callback(null);
      },
      afterListen: function (err) {
        assert(!err);
        done();
      }
    });
  });

  it('insert many test products', function () {
    var total = 50;
    var i = 1;
    return insertNext();
    function insertNext () {
      var product = _.assign(apos.modules.products.newInstance(), {
        title: 'Cheese #' + padInteger(i, 5),
        slug: 'cheese-' + padInteger(i, 5)
      });
      return apos.modules.products.insert(apos.tasks.getReq(), product).then(function () {
        i++;
        if (i <= total) {
          return insertNext();
        }
        return true;
      });
    }
  });

  it('export the products', function (done) {
    var req = apos.tasks.getReq();
    let good = 0;
    let bad = 0;
    let results;
    apos.modules.products.exportRun(req, {
      good: function () {
        good++;
      },
      bad: function () {
        bad++;
      },
      setResults: function (_results) {
        results = _results;
      }
    }, {
      extension: 'csv',
      format: apos.modules.products.exportFormats.csv,
      // test multiple batches with a small number of products
      batchSize: 10,
      // don't let the timeout for deleting the report afterwards
      // prevent this test from ending
      expiration: 5000
    }, function (err) {
      assert(!err);
      assert(good === 50);
      assert(!bad);
      assert(results);
      request(results.url, function (err, response, body) {
        assert(!err);
        assert(response.statusCode === 200);
        assert(body.match(/,Cheese #00001,/));
        done();
      });
    });
  });
});

function padInteger (i, places) {
  var s = i + '';
  while (s.length < places) {
    s = '0' + s;
  }
  return s;
}
