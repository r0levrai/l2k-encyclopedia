export { tiles };

const request = await fetch('tiles.html')
const htmlString = await request.text();
const tiles = new DOMParser().parseFromString(htmlString, "text/html");
