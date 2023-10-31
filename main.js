window.onload = function () {
  console.log('starting...');

  fetch("data/vehicles.json")
    .then(response => response.json())
    .then(json => load_vehicles(json));

  fetch("data/bricks.json")
    .then(response => response.json())
    .then(json => load_bricks(json));
}

function load_vehicles(json) {
  const tiles = document.getElementById("vehicles");
  for (let part_id in json) {
    let data = json[part_id];

    let tile = document.getElementById("v_tile").cloneNode(true);
    tile.querySelector('#v_name').innerText = data.name;

    rarity = {
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
    tiles.onclick = () => alert(data.id);
    tiles.append(tile);
  }
  document.getElementById("v_tile").remove();
  console.log('loaded', Object.keys(json).length, 'vehicles');
}

function load_bricks(json) {
  const tiles = document.getElementById("bricks");
  for (let part_id in json) {
    let data = json[part_id];

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
  document.getElementById("brick_tile").remove();
  console.log('loaded', Object.keys(json).length, 'bricks');
}

function snakecase(string) {
  return string.charAt(0).toLowerCase() + string.slice(1);
}