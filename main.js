import { SuffixTree } from './search.js';

console.log('starting...');

let search_index = new SuffixTree();
let serch_input = document.querySelector(".search-text");
let serch_results = document.querySelector("#search-results");
let serch_category = document.querySelector("#search-category");
let search_count = 0;
serch_input.addEventListener('input', function (evt) {
  search_count++;
  let local_count = search_count;
  let text = this.value;
  let results;
  if (text != '') {
    let start = performance.now();
    results = search_index.search_all_words(text);
    let end = performance.now(); console.log(`seach ${local_count}: ${end - start} ms`);
  }
  // tried those 3 options, roughly equivallent in perf:
  // option 1: 160-200ms
  //serch_results.innerHTML = '';
  //for (let tile of results)
  //  serch_results.append(tile.cloneNode(true));
  // option 2: 200-210ms
  //serch_results.innerHTML = [...results].map((tile) => tile.outerHTML).join('');  // clear all children
  // option 3: 160-210ms
  //serch_results.replaceChildren(...[...results].map((tile) => tile.cloneNode(true)));
  //
  // however, the true answer is to force a rerender mid-loop by defering
  // the loop content in a setTimeout call! here we go:
  serch_results.replaceChildren([]);
  if (text != '') {
    yieldingLoop(results.length, 32, function (i) {
      if (local_count == search_count)
        serch_results.append(results[i].cloneNode(true));
    }, function () {
      //  ...add next things here
    }, `display ${local_count}`);
  }
})

fetch("data/vehicle_by_name.json")
  .then(response => response.json())
  .then(json => load_vehicles(json));

fetch("data/bricks.json")
  .then(response => response.json())
  .then(json => load_bricks(json));

function load_vehicles(json) {
  const tiles = document.getElementById("vehicles");
  /*for (let key in json) {
    load_vehicle(json[key], tiles);
  }*/
  json = Object.values(json);
  yieldingLoop(json.length, 32, function (i) {
    load_vehicle(json[i], tiles);
  }, function () {
    //  ...add next things here
  }, 'vehicles');
}

document.getElementById('main').style.height = '210000px';
  // help refresh and back navigation scroll restoration

function load_bricks(json) {
  const tiles = document.getElementById("bricks");
  /*for (let key in json) {
    load_brick(json[key], tiles);
  }*/
  json = Object.values(json);
  yieldingLoop(json.length, 32, function (i) {
    load_brick(json[i], tiles);
  }, function () {
    //  ...add next things here
    console.log('a')
    document.getElementById('main').style.height = '';
      // restore correct height
  }, 'bricks');
}

function load_vehicle(data, tiles) {
  let tile = document.getElementById("v_tile").cloneNode(true);
  tile.querySelector('#v_name').innerText = data.name;

  let rarity = {
    null: 'rarity0',
    'Cool': 'rarity1',
    'Awesome': 'rarity2',
    'SuperAwesome': 'rarity3'
  }[data.rarity]
  tile.classList.remove('rarity3');
  tile.classList.add(rarity);

  if (data.perk == null) {
    tile.querySelector('#v_perk').style.visibility = 'hidden';
  } else {
    tile.querySelector('#v_perk').src = `icons/vehicle-perks/${snakecase(data.perk)}.png`;
  }

  tile.querySelector('#v_terrain').src = `icons/vehicle-terrain/${snakecase(data.terrain)}.png`;
  tile.querySelector('#v_n_surplus').innerText = data.n_surplus;
  // tile.querySelector('#brick_weight').innerText = data.weight
  //tile.querySelector('#v_image').loading = "lazy";
  //tile.querySelector('#v_image').src = ... + data.img + '.png';
  tile.href = 'vehicle.html?' + data.name;
  tiles.append(tile);

  search_index.add(data.name, tile);
  //search_index.add(data.id, tile);
  if (data.perk != null) {
    search_index.add(data.perk, tile);
  }
}

function load_brick(data, tiles) {
  let tile = document.getElementById("brick_tile").cloneNode(true);
  tile.querySelector('#brick_name').innerText = data.name;
  tile.querySelector('#brick_id').innerText = '#' + data.id;
  tile.querySelector('#brick_size').innerText = data.size.join('x');
  tile.querySelector('#brick_weight').innerText = data.weight.toPrecision(3) / 1;
  // the division per 1 trim the trailing zeros (and remove the sci notation)
  tile.querySelector('#brick_image').loading = "lazy";
  tile.querySelector('#brick_image').src = 'textures/bricks/' + data.id + '.png';
  if (!data.is_surplus) {
    tile.querySelector('#brick_source').style.visibility = "hidden";
  }
  tile.querySelector('#brick_n_usage').innerText = data.n_usage;
  tiles.append(tile);

  search_index.add(data.name, tile);
  search_index.add(data.id.toString(), tile);
  search_index.add(data.size.join('x'), tile)
}


function yieldingLoop(count, chunksize, callback, finished, verbose = false) {
  if (verbose) { var t1 = performance.now(); }
  var i = 0;
  (function chunk() {
    var end = Math.min(i + chunksize, count);
    for (; i < end; ++i) {
      callback.call(null, i);
    }
    if (verbose && i-chunksize==0) { console.log(`first ${verbose}: ${performance.now() - t1} ms`); }
    if (i < count) {
      setTimeout(chunk, 0);
      chunksize *= 2; // double the chunk size every
      // iteration so that we can have a better
      // time-to-interactive vs. final computation time
      // tradeoff (since small chunk slow us down a lot,
      // but are necessary for a fast first preview)
    } else {
      if (verbose) { console.log(`full ${verbose}: ${performance.now() - t1} ms`); }
      finished.call(null);
    }
  })();
}

function snakecase(string) {
  return string.charAt(0).toLowerCase() + string.slice(1);
}

function len(object) {
  return Object.keys(object).length;
}