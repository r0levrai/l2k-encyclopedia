"""v1: determine surplus parts from BrickPack data, don't work very well (false positives)"""

import json
import pathlib
from glob import glob
import urllib.request
from urllib.error import HTTPError
n_chassis_pieces = 14
vehicle = [int(s) for (i, s) in enumerate(open("surplus_vehicle.txt").readlines()[n_chassis_pieces:]) if i%2==0]
#print(vehicle)
with open("parts_dump.json") as f:
    bricks_dict = json.load(f)

parts_in_packs = [] # including the starting parts, present in DefaultBrickPack.uasset

for pack_path in glob("../Exports/LEGO2KDrive/Content/LEGO/BrickPacks/*.json"):
    with open(pack_path) as f:
        json_dict = json.load(f)
        parts = "LegoPartRefs"
    for part in json_dict[0]["Properties"].get("LegoPartRefs", []):
        parts_in_packs.append(part["DesignId"])
    for wheel in json_dict[0]["Properties"].get("Wheels", []):
        parts_in_packs.append(wheel["AssetPathName"])
"""
    for chassis in json_dict[0]["Properties"]["ChassisConfigs"]:
        parts_in_packs.append(chassis["AssetPathName"])
    for flair in json_dict[0]["Properties"]["LegoAssemblies"]:
        parts_in_packs.append(flair["AssetPathName"])
"""
#print(parts_in_packs, sep='\n')

surplus = set(vehicle) - set(parts_in_packs)

pathlib.Path("surplus/").mkdir(parents=True, exist_ok=True)
for id in surplus:
    name = bricks_dict[str(id)]['name']
    print(f"{name} ({id})")
    try:
        urllib.request.urlretrieve(f"https://2kdrivetools.github.io/resources/Bricks/T_{id}_Icon.png", f"surplus/{id}.png")
    except HTTPError:
        print(" | could not download image")


# TODO: add wheel assemblies, remove chassis assembly automaticly, check other assemblies as assemblies