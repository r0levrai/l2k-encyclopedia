import { load_brick, load_async, snakecase } from './load.js';

{
  const id = get_url_param()
  
  Promise.all([
    fetch(`data/vehicle_parts/${id}.json`).then(response => response.json()),
    fetch('data/bricks_by_id.json').then(response => response.json()),
    fetch('data/brick_aliases.json').then(response => response.json())
  ]
  ).then(([vehicle, all_bricks, brick_aliases]) => {
    load_vehicle(vehicle);
    load_parts(vehicle, all_bricks, brick_aliases);
  });
}
    
function load_vehicle(vehicle) {
  document.getElementById("name").innerText = vehicle.name;
  document.getElementById('terrain').src = `icons/vehicle-terrain/${snakecase(vehicle.terrain)}.png`;
  if (vehicle.perk == null) {
    document.getElementById('perk').style.visibility = 'hidden';
  } else {
    document.getElementById('perk').src = `icons/vehicle-perks/${snakecase(vehicle.perk)}.png`;
  }
  document.querySelector('#vehicle > #preview > img').src = 'textures/woosh_big.png';
}

function load_parts(vehicle, all_bricks, brick_aliases) {
  let surplus_ids = new Set();
  for (let [part, color] of vehicle["parts_and_colors"]) {
    let brick_id = brick_aliases[part];
    if (all_bricks[brick_id].is_surplus) {
      surplus_ids.add(brick_id);
    }
  }
  let surplus_bricks = [...surplus_ids].map(i => all_bricks[i])
  load_async(surplus_bricks, load_brick, "bricks")
}

function get_url_param() {
  return decodeURIComponent(  // remove the %20 etc
    window.location.search  // get url after '?', included
  ).substring(1);             // remove the leading '?'
}