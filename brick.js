import { load_vehicle, load_brick, load_source, load_async, snakecase, load_simple } from './load.js';
import { tiles } from './tiles.js';

{
  const id = get_url_param()
  
  Promise.all([
    fetch(`data/brick_usage/${id}.json`).then(response => response.json()),
    fetch('data/bricks_by_id.json').then(response => response.json()),
    fetch('data/brickpacks_by_id.json').then(response => response.json()),
    fetch('data/vehicles_by_id.json').then(response => response.json())
  ]
  ).then(([brick, all_bricks, all_brickpacks, all_vehicles]) => {
    load_main_brick(brick);
    load_aliases(brick, all_bricks);
    load_brickpacks(brick, all_brickpacks);
    load_usage(brick, all_vehicles);
  });
}
    
function load_main_brick(data) {
  console.log(data);
  document.getElementById("name").innerText = data.name;
  document.getElementById('brick_id').innerText = '#' + data.id;
  document.getElementById('brick_size').innerText = data.size.join('x');
  document.getElementById('brick_weight').innerText = data.weight.toPrecision(3) / 1;
  // the division per 1 trim the trailing zeros (and remove the sci notation)
  document.querySelector('#preview > img').src = !data.no_image ? 'textures/bricks/' + data.id + '.png' : 'textures/woosh.png';
  document.getElementById('surplus-' + data.is_surplus).style.display = "block";
}

function load_aliases(brick, all_bricks) {
  let aliases = brick.aliases.filter((id) => id in all_bricks)
                             .map((id) => all_bricks[id]);
  load_async(aliases, load_brick, "aliases", "bricks_template");
}

function load_brickpacks(brick, all_brickpacks) {
  let brickpack_ids = brick.sources.map(source => source.name);
  let brickpacks = brickpack_ids.map(id => all_brickpacks[id]);
  for (let bp of brickpacks) {
    if (bp.name == 'Default') {
      bp.name = 'Available by default!'
    }
  }
  if (brickpacks.length > 0) {
    load_async(brickpacks, load_simple, "brickpacks");
  }
  else if (!brick.is_surplus) {
    document.getElementById('brickpacks').replaceChildren(
      tiles.getElementById('no_brickpack')
    );
  }
}

function load_usage(brick, all_vehicles) {
  let vehicles = brick.usage.map((id) => all_vehicles[id]);
  if (vehicles.length > 0) {
    load_async(vehicles, load_vehicle, "vehicles");
  }
  else if (brick.is_surplus) {
    document.getElementById('vehicles').replaceChildren(
      tiles.getElementById('no_vehicle')
    );
  }
}

function get_url_param() {
  return decodeURIComponent(  // remove the %20 etc
    window.location.search  // get url after '?', included
  ).substring(1);             // remove the leading '?'
}