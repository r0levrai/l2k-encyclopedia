"""v2: determine surplus parts from Bricks data, much better (it was theeeeere dammit)"""

import json
import pathlib
from glob import glob
from shutil import copy


parts_in_packs = [] # including the starting parts, present in DefaultBrickPack.uasset
brick_names = {}
base_path = "../Exports/LEGO2KDrive/Content/LEGO/"
    
def populate_from_parts():
    for part_path in glob(base_path + "Bricks/*.json"):
        name = pathlib.Path(part_path).stem
        if name.startswith('LPG_') or name.startswith('T_') or name.startswith('SM_'):
            continue
        with open(part_path) as f:
            try:
                json_dict = [d for d in json.load(f) if d["Type"] == "LegoPart"]
                brick_names[int(name)] = json_dict[0]["Properties"]["PartName"].get("CultureInvariantString", name)
                if json_dict[0]["Properties"].get("bIsInBrickPack", False):
                    parts_in_packs.append(int(name))
            except (IndexError, KeyError, ValueError) as e:
                print(" | could not determine if part", name, "is in a brickpack:", e)
populate_from_parts()
#print(parts_in_packs, sep='\n')
print(len(parts_in_packs), "parts in packs.")

def vehicle_surplus(parts_in_vehicle):
    return set(parts_in_vehicle) - set(parts_in_packs)

if __name__ == '__main__':

    parts_in_vehicle = [int(s) for (i, s) in enumerate(open("surplus_vehicle.txt").readlines()) if i%2==0]

    pathlib.Path("surplus/").mkdir(parents=True, exist_ok=True)
    for id in surplus:
        print(f"{brick_names[id]} ({id})")
        try:
            copy(base_path + f"Bricks/T_{id}_Icon.png", f"surplus/{id}.png")
        except FileNotFoundError:
            print(" | could not copy image", base_path + f"Bricks/T_{id}.png")


# TODO: add wheel assemblies