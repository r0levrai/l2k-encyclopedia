import { load_vehicle, load_brick, load_source, load_async, load_simple, snakecase, removeSuffix } from './load.js';
import { tiles } from './tiles.js';

{
  const id = get_url_param();
  const itemType = removeSuffix(get_url_basename(), '.html');

  Promise.all([
    fetch('data/'+itemType+'s_by_id.json').then(response => response.json()),
    //fetch('data/sources_for_any_id.json').then(response => response.json()),
    //fetch(`data/brick_usage/${id}.json`).then(response => response.json()),
    fetch('data/bricks_by_id.json').then(response => response.json()),
    //fetch('data/vehicles_by_id.json').then(response => response.json())
  ]
  ).then(([items, all_bricks /*, all_brickpacks, all_vehicles*/]) => {
    load_item(items[id], itemType);
    load_async(items[id].sources, load_source, "sources");
    if (itemType == 'brickpack')
    {
      load_async(items[id].bricks.map(id => all_bricks[id]), load_brick, "pieces", "bricks_template");
    }
    //load_brickpacks(brick, all_brickpacks);
    //load_usage(brick, all_vehicles);
  });
}

function load_item(data, itemType) {
  console.log(data);
  document.getElementById("name").innerText = data.name;
  // the division per 1 trim the trailing zeros (and remove the sci notation)
  document.querySelector('#preview > img').src = !data.no_image ? 'textures/' + itemType + 's' + '/' + data.id + '.png' : 'textures/woosh.png';
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
    window.location.search    // get url after '?', included
  ).substring(1);             // remove the leading '?'
}

function get_url_basename() {
  return decodeURIComponent(  // remove the %20 etc
    window.location.pathname  // get url before '?' and '#'
  ).split('/')                // 
  .filter(Boolean)            // remove empty parts
  .at(-1);                    // get last part
}