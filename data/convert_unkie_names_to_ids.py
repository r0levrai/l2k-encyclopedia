import csv
import json
from functools import cache

@cache
def read_json(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)

path_in = "unkie/update 5 manually typed by burger/without_ids.csv"
path_out = "unkie/update 5 manually typed by burger/with_ids.csv"
with open(path_in, encoding='utf-8') as file_in, open(path_out, 'w', encoding='utf-8') as file_out:
    for i_row, row in enumerate(csv.reader(file_in)):
        if i_row == 0:  # ignore header
            continue
        tab, subtab, name, price, rarity = row
        tab = ' '.join(tab.split(' ')[1:])
        subtab = ' '.join(subtab.split(' ')[1:])
        price = int(price)
        rarity = int(rarity.split(' ')[0])
        rarity = {
            0: None,
            1: 'Cool',
            2: 'Awesome',
            3: 'SuperAwesome'
        }[rarity]
        store_data_for_subtab = {
            'Street': 'vehicles_by_id.json',
            'Off-Road': 'vehicles_by_id.json',
            'Water': 'vehicles_by_id.json',
            'Drivers': None,
            'Flair': 'flairs_by_id.json',
            'Stickers': 'stickers_by_id.json',
            'Brick Packs': 'brickpacks_by_id.json',
            'Engines': None,
            'Horns': None,
        }
        id_for_name = {
            'Tall Flag (Blue)': 'Flagpole_31079_Blue',  # could be 'Flagpole_31079_Blue' or 'Flagpole_31079'
            'Sunset Track Racer': 'TrackRacer_31089',  # could be 'SportsCar_31089' (offroad) or 'TrackRacer_31089' (street)
            'School Bus': 'SchoolBus_60329',  # could be 'SchoolBus_VC70423' (garage_valid: 'CostExceeded') or 'SchoolBus_60329' (license: "City")
        }
        if tab == 'Store':
            data_path = store_data_for_subtab[subtab]
            if data_path is None:
                continue
            item_data = read_json(data_path)
        elif tab == 'Official':
            item_data = read_json('vehicles_by_id.json')
        else:
            raise NotImplemented(tab)
        if item_data is not None:
            items = [item for item in item_data.values() if name.lower() == item['name'].replace(' (new!)', '').lower().strip()]
            if len(items) == 1:
                id = items[0]['id']
            elif not items:
                print(' | could not find item name', name)
                id = 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
            else:  # several matching items
                if name in id_for_name:
                    id = id_for_name[name]
                elif len([item for item in items if rarity == item['rarity']]) == 1:
                    items = [item for item in items if rarity == item['rarity']]
                    id = items[0]['id']
                else:
                    print(' | ambiguous id for item name', name, ': can be')
                    print(*items, sep='\n')
                    id = 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW'
        print(tab, subtab, name, price, rarity, id, sep=', ')
        print(id, tab, subtab, price, sep=', ', file=file_out)