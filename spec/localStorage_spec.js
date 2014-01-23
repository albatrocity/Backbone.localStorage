// Underscore methods:

_extend = function(obj) {
  Array.prototype.slice.call(arguments, 1).forEach(function(source) {
    if (source) {
      for (var prop in source) {
        obj[prop] = source[prop];
      }
    }
  });
  return obj;
};
_isObject = function(obj) {
  return obj === Object(obj);
};
_clone = function(obj) {
  if (!_isObject(obj)) return obj;
  return Array.isArray(obj) ? obj.slice() : _extend({}, obj);
};
_times = function(n, iterator, context) {
  var accum = Array(Math.max(0, n));
  for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
  return accum;
};
_values = function(obj) {
  var keys = Object.keys(obj);
  var length = keys.length;
  var values = new Array(length);
  for (var i = 0; i < length; i++) {
    values[i] = obj[keys[i]];
  }
  return values;
};
_identity = function(value) {
  return value;
};
_toArray = function(obj) {
  if (!obj) return [];
  if (Array.isArray(obj)) return Array.prototype.slice.call(obj);
  if (obj.length === +obj.length) return obj.models.map(function(value) {return value});
  return _values(obj);
};



describe("Exoskeleton.localStorage", function(){

  var attributes = {
    string: "String",
    string2: "String 2",
    number: 1337
  };

  describe("on a Collection", function(){

    var Model = Backbone.Model.extend({
      defaults: attributes
    });

    var Collection = Backbone.Collection.extend({
      model: Model,
      localStorage: new Backbone.LocalStorage("collectionStore")
    });

    var collection = new Collection();


    // Clean up before starting
    before(function(){
      collection.localStorage._clear();
    });

    before(function(){
      collection.fetch();
    });

    it("should use `localSync`", function(){
      assert.equal(Backbone.getSyncMethod(collection), Backbone.localSync);
    });

    it("should initially be empty", function(){
      assert.equal(collection.length, 0);
    });


    describe("create", function(){

      var model;

      before(function(){
        model = collection.create({});
      });

      it("should have 1 model", function(){
        assert.equal(collection.length, 1);
      });

      it("should have a populated model", function(){
        var withId = _clone(attributes);
        withId.id = model.id;
        assert.deepEqual(model.toJSON(), withId);
      });

      it("should have assigned an `id` to the model", function(){
        assert.isDefined(model.id);
      });

    });

    describe("get (by `id`)", function(){

      var model;

      before(function(){
        model = collection.create({});
      });

      it("should find the model with its `id`", function(){
        assert.equal(collection.get(model.id), model);
      });

    });

    describe("instances", function(){

      describe("save", function(){

        var model, model2;

        before(function(){
          model = collection.create({});
          model.save({string: "String 0"});
          collection.fetch()
        });

        it("should persist the changes", function(){
          assert.equal(model.get("string"), "String 0");
        });


        describe("with a new `id`", function(){

          before(function(){
            model2 = collection.create({});
            model2.save({id: 1});
            collection.fetch();
          });

          it("should have a new `id`", function(){
            assert.equal(model2.id, 1);
          });

          it("should have kept its old properties", function(){
            var withId = _clone(attributes);
            withId.id = 1;
            assert.deepEqual(model2.toJSON(), withId);
          });

        });


      });

      describe("destroy", function(){

        var beforeFetchLength, afterFetchLength;

        before(function(){
          // Make sure there's at least items in there
          // ... can't rely on previous tests
          _times(5, function(){
            collection.create()
          });
        });

        before(function(){
          var collArray = _toArray(collection)
          collArray.forEach(function(model){
            model.destroy();
          });
          beforeFetchLength = collection.length;
        });

        before(function(){
          collection.fetch();
          afterFetchLength = collection.length;
        });

        it("should have removed all items from the collection", function(){
          assert.equal(beforeFetchLength, 0);
        });

        it("should have removed all items from the store", function(){
          assert.equal(afterFetchLength, 0);
        });

      });

      describe("with a different `idAttribute`", function(){

        var Model2 = Backbone.Model.extend({
          defaults: attributes,
          idAttribute: "_id"
        });

        var Collection2 = Backbone.Collection.extend({
          model: Model2,
          localStorage: new Backbone.LocalStorage("collection2Store")
        });

        var collection2 = new Collection2();

        before(function(){
          collection2.create();
        });

        it("should have used the custom `idAttribute`", function(){
          assert.equal(collection2.models[0].id, collection2.models[0].get("_id"));
        });

      });

    });

  });

  describe("on a Model", function(){

    var Model = Backbone.Model.extend({
      defaults: attributes,
      localStorage: new Backbone.LocalStorage("modelStore")
    });

    var model = new Model();

    before(function(){
      model.localStorage._clear();
    });

    it("should use `localSync`", function(){
      assert.equal(Backbone.getSyncMethod(model), Backbone.localSync);
    });

    describe("fetch", function(){
      it('should fire sync event on fetch', function(done) {
        var model = new Model(attributes);
        model.on('sync', function(){
          done();
        });
        model.fetch();
      });
    });

    describe("save", function(){

      before(function(){
        model.save();
        model.fetch();
      });

      it("should be saved in the store", function(){
        assert.isDefined(model.id);
      });

      describe("with new attributes", function(){

        before(function(){
          model.save({number: 42});
          model.fetch();
        });

        it("should persist the changes", function(){
          assert.deepEqual(model.toJSON(), _extend(_clone(attributes), {id: model.id, number: 42}));
        });

      });

      describe('fires events', function(){
        before(function(){
          this.model = new Model();
        });
        after(function(){
          this.model.destroy();
        });

        it('should fire sync event on save', function(done) {
          this.model.on('sync', function(){
            this.model.off('sync');
            done();
          }, this);
          this.model.save({foo: 'baz'});
        });
      });

    });

    describe("destroy", function(){

      before(function(){
        model.destroy();
      });

      it("should have removed the instance from the store", function(){
        assert.lengthOf(Model.prototype.localStorage.findAll(), 0);
      });

    });

  });

  describe("Error handling", function(){

    var Model = Backbone.Model.extend({
      defaults: attributes,
      localStorage: new Backbone.LocalStorage("modelStore")
    });

    describe("private browsing", function(){

      var model = new Model()
        , oldSetItem = window.localStorage.setItem
        , oldStorageSize = model.localStorage._storageSize
        , error;

      before(function(done){
        model.localStorage._clear();

        // Patch browser conditions for private error.
        model.localStorage._storageSize = function(){ return 0; };
        window.localStorage.setItem = function(){
          var error = new Error();
          error.code = DOMException.QUOTA_EXCEEDED_ERR;
          throw error;
        };

        model.save(attributes, {
          error: function(model, err){
            error = err;
            done();
          }
        })
      });

      it("should return the error in the error callback", function(){
        assert.equal(error, "Private browsing is unsupported");
      });

      it('should throw an error event', function(done){
        model.on('error', function() {
          done();
        });
        model.save();
      });

      after(function(){
        // Unwrap patches.
        model.localStorage._storageSize = oldStorageSize;
        window.localStorage.setItem = oldSetItem;
      })

    });

  });

});

describe("Without Backbone.localStorage", function(){

  describe("on a Collection", function(){
    var Collection = Backbone.Collection.extend()
      , collection = new Collection();

    it("should use `ajaxSync`", function(){
      assert.equal(Backbone.getSyncMethod(collection), Backbone.ajaxSync);
    });
  });

  describe("on a Model", function(){
    var Model = Backbone.Model.extend()
      , model = new Model();

    it("should use `ajaxSync`", function(){
      assert.equal(Backbone.getSyncMethod(model), Backbone.ajaxSync);
    });
  });

});


// For some reason this is not ran when viewed in a browser
// but it is ran when using `mocha-phantomjs`.
describe("AMD", function(){

  require.config({
    paths: {
      backbone: "support/exoskeleton",
      localstorage: "../exoskeleton.localStorage"
    }
  });

  var LocalStorage;

  before(function(done){
    require(["localstorage"], function(LS){
      LocalStorage = LS;
      done()
    });
  });

  it("should be the same as the non-amd usage", function(){
    assert.equal(Backbone.LocalStorage, LocalStorage)
  });

});
