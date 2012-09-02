//  StringNegator is taken from http://stackoverflow.com/a/5846403/683826
var StringNegator = function (str) {
  str = str.toLowerCase().split('');
  str = _.map(str, function(letter) { 
    return String.fromCharCode(-(letter.charCodeAt(0)));
  });
  return str.join('');
};
//  I prefer creating reusable Factory Objects that can be extended
var GenericSortableFactoryObject = {
  changeGenericSorter: function(new_sorter){
    var asc_desc = 'ASC';
    var field_type = this.sortableFieldTypes[new_sorter];
    var new_comparator = function(Model) {
      return Model.get( new_sorter );
    };
    if( new_sorter === this.ordering_method ){
      asc_desc = (this.ordering_direction === 'ASC') ? 'DESC' : 'ASC';
    }
    if( asc_desc === 'DESC' ){
      if( field_type === 'string' ){
        new_comparator = function(Model) {
          return StringNegator( Model.get( new_sorter ) );
        };
      }
      else if( field_type === 'numeric' ){
        new_comparator = function(Model) {
          return -( Model.get( new_sorter ) );
        };
      }
    }
    this.ordering_method = new_sorter;
    this.ordering_direction = asc_desc;
    this.comparator = new_comparator;
  }
};

MyApp = new Backbone.Marionette.Application();
MyApp.addRegions({
  mainRegion: "#content"
});
AngryCat = Backbone.Model.extend({
  defaults: {
    votes: 0
  },
  addVote: function(){
    this.set('votes', this.get('votes') + 1);
  },
  rankUp: function() {
    this.set({rank: this.get('rank') - 1});
  },
  rankDown: function() {
    this.set({rank: this.get('rank') + 1});
  }
});
AngryCats = Backbone.Collection.extend( _.extend({}, GenericSortableFactoryObject, {
  model: AngryCat,
  initialize: function(cats){
    var rank = 1;
    this.ordering_method = 'rank';
    this.ordering_direction = 'ASC';
    _.each(cats, function(cat) {
      cat.set('rank', rank);
      ++rank;
    });
    this.on('add', function(cat){
      if( ! cat.get('rank') ){
        var error =  Error("Cat must have a rank defined before being added to the collection");
        error.name = "NoRankError";
        throw error;
      }
    });
    var self = this;
    MyApp.vent.on("rank:up", function(cat){
      if (cat.get('rank') == 1) {
        // can't increase rank of top-ranked cat
        return true;
      }
      self.rankUp(cat);
      self.sort();
    });
    MyApp.vent.on("rank:down", function(cat){
      if (cat.get('rank') == self.size()) {
        // can't decrease rank of lowest ranked cat
        return true;
      }
      self.rankDown(cat);
      self.sort();
    });
    MyApp.vent.on("cat:disqualify", function(cat){
      var disqualifiedRank = cat.get('rank');
      var catsToUprank = self.filter(
        function(cat){ return cat.get('rank') > disqualifiedRank; }
      );
      catsToUprank.forEach(function(cat){
        cat.rankUp();
      });
      self.trigger('reset');
    });
    MyApp.vent.on('Collection:new_sorter', function(new_sorter){
      self.changeGenericSorter(new_sorter);
      self.sort();
    });
  },
  comparator: function(cat) {
    return cat.get( this.ordering_method );
  },
  rankUp: function(cat) {
    // find the cat we're going to swap ranks with
    var rankToSwap = cat.get('rank') - 1;
    var otherCat = this.at(rankToSwap - 1);
    // swap ranks
    cat.rankUp();
    otherCat.rankDown();
  },
  rankDown: function(cat) {
    // find the cat we're going to swap ranks with
    var rankToSwap = cat.get('rank') + 1;
    var otherCat = this.at(rankToSwap - 1); 
    // swap ranks
    cat.rankDown();
    otherCat.rankUp();
  },
  sortableFieldTypes : {
    'name' : 'string',
    'rank' : 'numeric',
    'votes' : 'numeric'
  }
} ) );
AngryCatView = Backbone.Marionette.ItemView.extend({
  template: "#angry_cat-template",
  tagName: 'tr',
  className: 'angry_cat',
  events: {
    'click .rank_up img': 'rankUp',
    'click .rank_down img': 'rankDown',
    'click a.disqualify': 'disqualify'
  },
  initialize: function(){
    this.bindTo(this.model, "change:votes", this.render);
  },
  rankUp: function(){
    this.model.addVote();
    MyApp.vent.trigger("rank:up", this.model);
  },
  rankDown: function(){
    this.model.addVote();
    MyApp.vent.trigger("rank:down", this.model);
  },
  disqualify: function(){
    MyApp.vent.trigger("cat:disqualify", this.model);
    this.model.destroy();
  }
});
AngryCatsView = Backbone.Marionette.CompositeView.extend({
  tagName: "table",
  id: "angry_cats",
  className: "table-striped table-bordered",
  template: "#angry_cats-template",
  itemView: AngryCatView,
  appendHtml: function(collectionView, itemView){
    collectionView.$("tbody").append(itemView.el);
  },
  events: {
    'click .tablo-row-rank': 'sortByRank',
    'click .tablo-row-name': 'sortByName',
    'click .tablo-row-votes': 'sortByVotes'
  },
  sortByName: function(){
    this.handleNewSort('name');
  },
  sortByRank: function(){
    this.handleNewSort('rank');
  },
  sortByVotes: function(){
    this.handleNewSort('votes');
  },
  handleNewSort:function(new_sorter){
    MyApp.vent.trigger('Collection:new_sorter', new_sorter);
    this.handleSortClass();
  },
  handleSortClass:function(){
    var $temp = $(this.$el).find('thead > tr.header > th'), coll = this.collection;
    $temp = $temp.removeClass('ranking-selected').removeClass('ranking-desc');
    $temp = $temp.parent().find('.tablo-row-' + coll.ordering_method);
    $temp.addClass('ranking-selected');
    if( coll.ordering_direction === 'DESC'){
      $temp.addClass('ranking-desc');
    }
  }
});
MyApp.addInitializer(function(options){
  var angryCatsView = new AngryCatsView({
    collection: options.cats
  });
  MyApp.mainRegion.show(angryCatsView);
});
$(document).ready(function(){
  var cats = new AngryCats([
      new AngryCat({ name: 'Wet Cat', image_path: 'assets/images/cat2.jpg', votes: 4 }),
      new AngryCat({ name: 'Bitey Cat', image_path: 'assets/images/cat1.jpg', votes: 47 }),
      new AngryCat({ name: 'Surprised Cat', image_path: 'assets/images/cat3.jpg', votes: 23 })
  ]);
  MyApp.start({cats: cats});
  cats.add(new AngryCat({
    name: 'Cranky Cat',
    image_path: 'assets/images/cat4.jpg',
    rank: cats.size() + 1
    , votes: 16
  }));
});