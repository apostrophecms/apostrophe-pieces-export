// Extend apostrophe-pieces with browser side code for exports.

apos.define('apostrophe-pieces', {

  afterConstruct: function(self) {
    self.exportClickHandlers();
  },

  construct: function(self, options) {

    self.exportClickHandlers = function() {
      // The rest of these are not part of the admin bar, follow our own convention
      apos.ui.link('apos-export', self.name, function($button, _id) {
        self.export();
      });
    };
    
    self.export = function() {
      return self.getTool('export-modal');
    };

  }
});
