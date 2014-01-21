describe("Exoskeleton.localStorage in CommonJS environment", function() {

  var LocalStorage = require("../exoskeleton.localStorage");
  var Backbone = require("backbone");

  it("should be the same as the non-CommonJS usage", function(){
    assert.equal(Backbone.LocalStorage, LocalStorage);
  });
});
