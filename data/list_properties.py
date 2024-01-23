"""Helper to quickly debug what's in a .uasset file"""

from collections import Counter
import json
from pathlib import Path
from glob import glob
from pprint import pprint


def list_properties(in_files, detail=[], key="Properties"):
    property_key_count_for_type = {}
    property_value_count = {}

    for path in glob(in_files):
        with open(path) as f:
            json_dict = json.load(f)
        for struct in json_dict:
            type = struct["Type"]
            properties = struct[key]
            if type not in property_key_count_for_type:
                property_key_count_for_type[type] = Counter()
            property_key_count_for_type[type] = property_key_count_for_type[type] + Counter(properties.keys())
            
            for p in detail:
                if p in properties:
                    if p not in property_value_count:
                        property_value_count[p] = Counter()
                    property_value_count[p][str(properties[p])] += 1
                    
    print('properties:'); pprint(property_key_count_for_type)
    print('detail:');     pprint(property_value_count)


if __name__ == '__main__':
    base_path = "../Exports/LEGO2KDrive/Content/"
    in_files = base_path + "Game/Vehicle/Configs/VehicleConfig_*.json"
    list_properties(in_files, detail=['Rarity', 'License', 'VehicleClass'])
