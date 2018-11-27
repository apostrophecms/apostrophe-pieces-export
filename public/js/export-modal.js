// A modal for exporting pieces

apos.define('apostrophe-pieces-export-modal', {

  extend: 'apostrophe-modal',

  source: 'export-modal',

  construct: function(self, options) {
    self.manager = options.manager;
    self.canceling = false;
    self.beforeShow = function(callback) {
      self.$submit = self.$el.find('[data-apos-export]');
      self.$submit.click(function() {
        var draftOrLive = self.$el.find('[name="draft-or-live"]').val();
        var format = self.$el.find('[name="format"]').val();
        self.api('export', {
          draftOrLive: draftOrLive,
          format: format
        }, function(result) {
          if (data.result.status !== 'ok') {
            alert(data.result.status);
            return;
          }
          self.hide();
          apos.jobs.progress(data.result.jobId);
        });
        return false;
      });
      return setImmediate(callback);
    };
  }
});
