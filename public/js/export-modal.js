// A modal for exporting pieces

apos.define('apostrophe-pieces-export-modal', {

  extend: 'apostrophe-modal',

  source: 'export-modal',

  construct: function (self, options) {
    self.manager = options.manager;
    self.canceling = false;
    self.beforeShow = function (callback) {
      self.$submit = self.$el.find('[data-apos-export]');
      self.$submit.click(function () {
        var draftOrLive = self.$el.find('[name="draft-or-live"]').val();
        var published = self.$el.find('[name="published"]').val();
        var extension = self.$el.find('[name="extension"]').val();
        var data = {
          draftOrLive: draftOrLive,
          published: published,
          extension: extension
        };
        var $selects = self.$el.find('.apos-pieces-export-filter select');
        $selects.each(function() {
          var $select = $(this);
          if ($select.val().length) {
            data[$select.attr('name')] = $select.val();
          }
        });
        self.api('export', data, function (result) {
          if (result.status !== 'ok') {
            apos.notify(result.status, { type: 'error' });
            return;
          }
          self.afterHide = function () {
            apos.modules['apostrophe-jobs'].progress(result.jobId, {
              success: function (result) {
                // Download the report
                window.location.href = result.url;
              }
            });
          };
          self.hide();
        });
        return false;
      });
      return setImmediate(callback);
    };
  }
});
