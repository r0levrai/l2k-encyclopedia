window.onload = function () {
  const name = get_url_param()

  const r_vehicle = fetch(`data/vehicle_parts/${encodeURIComponent(name)}.json`).then(response => response.json());
  const r_all_bricks = fetch('data/bricks.json').then(response => response.json());
  const r_brick_aliases = fetch('data/brick_aliases.json').then(response => response.json());
  Promise.all([r_vehicle, r_all_bricks, r_brick_aliases])
    .then(([vehicle, all_bricks, brick_aliases]) => load_vehicle(vehicle, all_bricks, brick_aliases))
}

function load_vehicle(vehicle, all_bricks, brick_aliases) {
  document.getElementById("name").innerText = vehicle.name;
  document.getElementById('terrain').src = `icons/vehicle-terrain/${snakecase(vehicle.terrain)}.png`;
  if (vehicle.perk == null) {
    document.getElementById('perk').style.visibility = 'hidden';
  } else {
    document.getElementById('perk').src = `icons/vehicle-perks/${snakecase(vehicle.perk)}.png`;
  }
  surplus_parts = new Set();
  for (let [part, color] of vehicle["parts_and_colors"]) {
    brick_id = brick_aliases[part.toString()];
    if (all_bricks[brick_id].is_surplus) {
      surplus_parts.add(brick_id);
    }
  }
  for (let brick_id of surplus_parts) {
    load_brick(all_bricks[brick_id]);
  }
  document.getElementById("brick_tile").remove();
}

function get_url_param() {
  return decodeURIComponent(  // remove the %20 etc
    window.location.search  // get url after '?', included
  ).substring(1);             // remove the leading '?'

}

// --- from main.js

function load_brick(data) {
  const tiles = document.getElementById("bricks");

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
}

function snakecase(string) {
  return string.charAt(0).toLowerCase() + string.slice(1);
}