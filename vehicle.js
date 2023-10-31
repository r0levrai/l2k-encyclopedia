window.onload = function () {
    const vehicle_name = get_url_param()
    load_vehicle(vehicle_name);
}

function get_url_param() {
    return decodeURIComponent(  // remove the %20 etc
        window.location.search  // get url after '?', included
    ).substring(1);             // remove the leading '?'
    
}

function load_vehicle(name) {
    console.log(id);
}