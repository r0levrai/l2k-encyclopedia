export { load_async, load_vehicle, load_brick, yieldingLoop, snakecase };

function load_async(array, load_fn, parent_id, log = parent_id) {
  return new Promise((resolve, reject) => {
    const tiles = document.getElementById(parent_id);
    yieldingLoop(array.length, 32, 256, function (i) {
      load_fn(array[i], tiles);
    }, function () {
      resolve();
    }, log);
  });
}

/*function load_vehicles(vehicles, parent_id) {
  const tiles = document.getElementById(parent_id);
  for (let i in vehicles) {
    load_vehicle(vehicles[i], tiles);
  }
}
 
function load_bricks(json, parent_id) {
  const tiles = document.getElementById("bricks");
  for (let key in json) {
    load_brick(json[key], tiles);
  }
}*/

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
  tile.href = 'vehicle.html?' + data.id;
  tiles.append(tile);
  return tile;
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
  return tile;
}


function yieldingLoop(count, firstChunkSize, otherChunkSize, callback, finished, verbose = false) {
  if (verbose) { var t1 = performance.now(); }
  var i = 0;
  var chunksize = firstChunkSize;
  (function chunk() {
    var end = Math.min(i + chunksize, count);
    for (; i < end; ++i) {
      callback.call(null, i);
    }
    if (verbose && i - chunksize == 0) { console.log(`first ${verbose}: ${performance.now() - t1} ms`); }
    if (i < count) {
      chunksize = otherChunkSize;
      setTimeout(chunk, 0);
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