"""
Parse .uasset files into several .json served by the website

Before running this, you want to dump the following folders (relative to base_path) as:
- json:
  - Data/RewardsTables
  - LEGO/BrickPacks
  - LEGO/Bricks
  - LEGO/Flair
  - LEGO/Wheel
  - LEGO/Decorations
  - Garage/LegoAssets/Stickers
  - Game/Vehicle/Inventory/StatArchetypes
  - Game/Vehicle/Inventory/BoatChassisConfigs
  - Game/Vehicle/Inventory/CarChassisConfigs
  - Game/Vehicle/Configs
  - Game/Vehicle/Configs/BrickGraphs
  - Game/StringTables
  - Update_0/StringTables
  - Update_1/StringTables
  - Update_2/StringTables
  - Update_3/StringTables
  - Update_4/StringTables
  - Update_5/StringTables
  - Update_5
- png:
  - LEGO/BrickPacks
  - LEGO/Bricks
  - LEGO/Flair
  - LEGO/Flair/Thumbnails
  - LEGO/Wheel
  - LEGO/Decorations
  - Game/UI/Textures/4K/BrickPackImages
  - Game/UI/Textures/Garage/Stickers
- uasset:
  - Game/Vehicle/Configs/BrickGraphs

You can also copy your old ./data/*_by_id.json to ./data/last_version/ if you want
the new ones to have " (new!)" appended to their names
"""

from dataclasses import dataclass, asdict, is_dataclass
from collections import defaultdict, Counter
from itertools import chain
from typing import Optional, Any
import json
import csv
from pathlib import Path
from os.path import basename
from glob import glob
import filecmp
from shutil import copy as _copy
from urllib.parse import quote as escape

from vehicle_parts import parse_vehicle_parts  # straight from binary
from surplus_v2 import vehicle_surplus  # could have done it here
from list_properties import list_properties  # just a helper to print what to parse

try:
    from PIL import Image
    from sticker_uv_mapping import uv_map_pil
    do_uv_map = True
except ImportError as e:
    print('/!\ WARNING /!\: numpy/scipy/pillow not found. skipping the sticker uv transformations...', e.msg)
    do_uv_map = False


base_path = "../Exports/LEGO2KDrive/Content/"
brick_path = base_path + "LEGO/Bricks/"



def copy(src, dst, crop=False):
    Path(dst).parents[0].mkdir(parents=True, exist_ok=True)
    if crop:
        from PIL import Image
        image = Image.open(src)
        image.crop(image.getbbox()).save(dst)
    else:
        # for speed, only copy if dst != src (according to filesystem metadata)
        if not Path(dst).is_file() or not filecmp.cmp(src, dst):
            _copy(src, dst)

class EnhancedJSONEncoder(json.JSONEncoder):
    def default(self, o):
        if is_dataclass(o):
            return asdict(o)
        elif isinstance(o, set):
            return list(o)
        else:
            return super().default(o)

def dump(name, value, add_new_to_name=True, verbose=True):
    json_path = f'./{name}.json'
    new_count = 0
    if add_new_to_name and (Path('last_version') / json_path).is_file():
        with open(Path('last_version') / json_path) as old_file:
            old_value = json.load(old_file)
        for k, v in value.items():
            if str(k) not in old_value:
                v.name += ' (new!)'
                new_count += 1
    Path(json_path).parents[0].mkdir(parents=True, exist_ok=True)
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(value, f, cls=EnhancedJSONEncoder, ensure_ascii=False)
    if verbose:
        print('-> Dumped', len(value), name
              + (f' ({new_count} new!)' if new_count else ''))
        
def proper_sort_dict(dict_):
    return dict(sorted(dict_.items(), key=lambda kv: proper_order(kv[1].name)))

def proper_sort_lists(*lists):
    """sort n lists according to the first list, in a sane 'letters -> numbers -> specials' order"""
    return invert_zip(sorted(zip(*lists), key=lambda t: proper_order(t[0].name)))

def proper_order(key):
    # from unidecode import unidecode
    # key = unidecode(key)
    return [
        (1, char.lower()) if char.isalpha() else (2, char) if char.isnumeric() else (3, char)
    for char in key]

def invert_zip(args):
    return zip(*args)


def load(paths, exclude_paths="", exclude_prefix=['T_', 't_', 'SM_', 'LPG_'],
         type="", key="Properties", remove_type_prefix=True,
         n_per_file=1, rename_ids={}):
    for path in set(glob(paths, recursive=True)) - set(glob(exclude_paths, recursive=True)):
        if any(Path(path).stem.startswith(prefix) for prefix in exclude_prefix):
            continue
        id = Path(path).stem
        with open(path, encoding='utf-8') as f:
            json_dicts = [uecomponent for uecomponent in json.load(f) if uecomponent["Type"] == type]
        if n_per_file is not None:
            assert len(json_dicts) == n_per_file, f'found {len(json_dicts)} {type} in file {id}, expected {n_per_file}'
        for uecomponent in json_dicts:
            id = rename_ids.get(id, id)
            id2 = rename_ids.get(uecomponent["Name"], uecomponent["Name"])
            assert id2 == id or id2 == f'{type}_{id}', (f'found name {json_dicts[0]["Name"]}, expected {str(id)}.\n'
                                                       "You can add {'bad_one': 'good_one'} to the rename_ids parameter.")
            prefix = remove_type_prefix if isinstance(remove_type_prefix, str) else f'{type}_'
            original_id = id
            if remove_type_prefix and id.lower().startswith(prefix.lower()):
                id = id[len(prefix):]  # case insensitive prefix removal
            properties = uecomponent[key]
            yield id, properties, original_id

# NB: localizations are in .../<lang>/<Game or UpdateN>.locres -> json[0]["StringTable"]["KeysToMetaData"]["StringTable_VehicleParts"]["Vehicle_Name.<key>"]

def try_parse(properties, key, default=None, required=False):
    if key not in properties:
        assert not required, f'{properties}\n-> did not find required {key} in the json above'
        return default
    elif isinstance(prop := properties[key], dict):
        if 'ObjectPath' in prop:
            return Path(prop['ObjectPath']).stem
        elif 'AssetPathName' in prop:
            return Path(prop['AssetPathName']).stem
        else:
            return properties[key]
    elif isinstance(prop, list):
        return [try_parse({0: p}, 0, default=default, required=required) for p in prop]
    elif isinstance(prop, str) and '::' in prop:
        return prop.split('::')[-1]
    else:
        return properties[key]

string_tables = {}
def get_name(properties, key=None, default=None, required=False):
    name_property = properties if key is None else try_parse(properties, key, required=required)
    if name_property is None:  # reached only if not requiered, otherwise
        return default         # try_parse would have raised an exception
    if 'TableId' in name_property and 'Key' in name_property:
        table_id = name_property['TableId']
        key = name_property['Key']
        if table_id not in string_tables:
            string_table_file = table_id.replace('/Game/', '', 1).split('.')[0] + '.json'
            assert table_id.count('.') <= 1, f'need better extension remover code for {table_id}'
            try:
                with open(base_path + string_table_file) as f:
                    string_tables[table_id] = json.load(f)[0]['StringTable']['KeysToMetaData']
            except FileNotFoundError as e:
                e.args = (*e.args, 'maybe you forgot to dump the game files from the new update(s)?', string_table_file)
                raise(e)
        try:
            return string_tables[table_id][key]
        except KeyError as e:
            e.args = (*e.args, 'maybe you forgot to re-dump the game files from the new update(s)?', table_id.replace('/Game/', '', 1).split('.')[0] + '.json')
            raise(e)
    elif 'CultureInvariantString' in name_property:
        return name_property['CultureInvariantString']
    elif 'LocalizedString' in name_property:
        return name_property['LocalizedString']
    elif not required:
        return default
    else:
        raise(KeyError(f'cannot find required name in {name_property}'))

def small_round(float_):
    '''get rid of those pesky 3.00000000002'''
    return round(1e5 * float_) / 1e5

def encodeURIComponent(string):
    '''equivallent to the javascript function of the same name (hopefully)'''
    return escape(string, safe='~()*!\'')



@dataclass
class Source:
    type: str
    name: str
    biome: Optional[str]
    rewards: dict[str, int]

Source.default = Source('default', 'Unlocked by default!', None, {})

biomes = ['Turbo Acres', 'Big Butte', 'Frontier Valley', 'Haunts', 'Ice']  # found in Data/RewardsTable/CollectiblesRewardsTable.json or Data/RewardsTable/RaceRewardsTable.json
def get_biome(in_string, default=None, required=False):
    if not in_string:
        assert not required, f"empty in_string: '{in_string}'"
        return default
    biome_candidates = [b for b in biomes if b in in_string]
    if len(biome_candidates) != 1:
        assert not required, f"found {len(biome_candidates)} biomes (expected 1) in string: '{in_string}'"
        return default
    return biome_candidates[0]

def is_hex(string, length=None):
    try:
        int(string, 16)
        return length is None or len(string) == length
    except ValueError:
        return False

#list_properties(base_path +  "Data/RewardsTables/*.json", key='Rows')

all_sources = []
sources_for_any_id = defaultdict(list)
def parse_sources(verbose=False):
    for id, rows, oid in load(base_path + "Data/RewardsTables/*.json", type='DataTable', key='Rows'):
        if verbose: print(id.replace('RewardsTable', '').strip('_'))
        for row_id, row in rows.items():
            type = id.replace('RewardsTable', '').strip('_')
            name = row_id if not is_hex(row_id, length=32) else None
            notes = try_parse(row, "Notes")
            context = try_parse(row, "ContextString")

            rewards = {}
            rewards['xp'] = try_parse(row, "StudPoints")
            rewards['bux'] = try_parse(row, "BrickBux")
            rewards['flag'] = try_parse(row, "CheckeredFlags")
            for reward in try_parse(row, "LockRewards", []):
                rewards[reward["LockRewardAsset"]["PrimaryAssetName"]] = 1
            rewards = {k: v for (k, v) in rewards.items() if v}  # if v is not None and v != 0 and v != []
            if verbose and rewards: print(f' | {name}, {notes}, {context}: {rewards}')

            biome = None
            if type == 'Quest':
                ueclassprefix = 'Activities.Quests.'
                after_prefix = context[context.find(ueclassprefix) + len(ueclassprefix):]
                name = after_prefix.split()[0].split('|')[0]
            elif type == 'Collectibles':
                type = 'Collectible'
                name = notes
                name = (
                    name.replace('Frontier:', 'Frontier Valley:')
                        .replace('Biome 5', 'Ice')
                )
            elif type == 'Minigame':
                if 'Objectives.BeatenActivity' not in context:
                    continue
                name = notes
            elif 'DrivePass' in type:
                if verbose: print(type, id)
                season = type.removeprefix('DrivePass_Season')
                tier = name.removeprefix('Tier')
                name = f'Season {season} Tier {tier}'
                type = 'DrivePass'  # remove '_Season{n}'
            elif 'ReverseRace' in type:
                name = row_id
            elif 'Race' in type:
                name = notes
                name = (
                    name.replace('FFF', 'Fast Food And Furious')
                        .replace('CA1', 'Champions Arena 1')
                        .replace('Glazed', 'Glazed And Confused')
                        .replace('CA2', 'Champions Arena 2')
                        .replace('CA3', 'Champions Arena 3')
                )
                ueclassprefix = 'Objectives.BeatenActivity.Class'
                after_prefix = context[context.find(ueclassprefix) + len(ueclassprefix):]
                race_class = after_prefix.split()[0].split('|')[0]
                name += f' (Class {race_class})'
                biome = get_biome(name)
            elif 'Folk' in type:
                pass #TODO: some minifig rewards
            elif 'Default' in type:
                name = name.replace('OTG', 'OnTheGo')
            else:
                pass # small rewards, not adding for now
            
            biome = get_biome(name)
            all_sources.append(Source(type.lower(), name, biome, rewards))
            for reward in rewards:
                sources_for_any_id[reward].append(all_sources[-1])
    with open("unkie/update 5 manually typed by burger/with_ids.csv", encoding='utf-8') as f:
        for row in csv.reader(f):
            id, tab, subtab, price = row
            all_sources.append(Source('unkie_permanent', f'{tab}: {subtab.strip()}: {price}Brickbux', None, {id: 1}))
            sources_for_any_id[id].append(all_sources[-1])
parse_sources()
#dump("sources", all_sources)  # defered for adding brickpacks
#dump("sources_for_any_id", sources_for_any_id)  # defered for adding brickpacks

# TODO: check for supplementary mission reward at LEGO2KDrive/Content/Data/MissionData/LD_Desert



@dataclass
class BrickPack:
    id: str
    name: str
    rarity: str
    bricks: list[int]
    chassis: list[str]
    assemblies: list[str]
    wheels: list[str]
    sources: list

# list_properties(base_path + 'LEGO/BrickPacks/*.json')

def try_parse_image(properties, key, default=None, required=False, ext='.png'):
    if key not in properties:
        assert not required, f'{properties}\n-> did not find required {key} in the json above'
        return default
    if "ObjectPath" in properties[key]:
        path = properties[key]["ObjectPath"].replace('LEGO2KDrive/Content/', '', 1)
    elif "AssetPathName" in properties[key]:
        path = properties[key]["AssetPathName"].replace('/Game/', '', 1)
    else:
        assert not required, f'{properties}\n-> did not find required {key}\'s AssetPathName or ObjectPath in the json above'
        return default
    path = '.'.join(path.split('.')[:-1])  # remove last '.' and things after
    return base_path + path + ext

brickpacks = []
brickpacks_by_id = {}
def parse_brickpacks():
    for id, properties, oid in load(base_path + "LEGO/BrickPacks/*.json", type='BrickPack'):
        name = get_name(properties, "BrickPackName", required=True)
        assert(str(name) != '<built-in function id>')
        rarity = try_parse(properties, "Rarity")
        bricks = [int(d['DesignId']) for d in try_parse(properties, "LegoPartRefs", [])]
        chassis = try_parse(properties, "ChassisConfigs", [])
        assemblies = try_parse(properties, "LegoAssemblies", [])
        wheels = try_parse(properties, "Wheels", [])
        sources = sources_for_any_id.get(oid, [])
        if try_parse(properties, "AlwaysUnlocked", False):
            sources.append(Source.default)
            name = Source.default.name
        
        i1 = try_parse_image(properties, "Thumbnail")
        i2 = try_parse_image(properties, "Thumbnail_Showcase")
        missing = i1 is None or i2 is None
        if missing:
            i2 = base_path + 'Game/UI/Textures/4K/Misc/t_temp_brickpack.png'
            i1 = '../textures/sources/default.png' if 'Default' in sources else i2
        copy(i1, f'../textures/brickpacks/{id}.png', crop=(not missing))
        copy(i2, f'../textures/brickpacks_big/{id}.png')

        brickpacks.append(BrickPack(id, name, rarity, bricks, chassis, assemblies, wheels, sources))
        brickpacks_by_id[id] = brickpacks[-1]

parse_brickpacks()
#dump('brickpacks', brickpacks)
brickpacks_by_id = proper_sort_dict(brickpacks_by_id)
dump('brickpacks_by_id', brickpacks_by_id)

def add_brickpacks_to_sources():
    for pack in brickpacks:
        rewards = {id: 1 for id in pack.bricks + pack.chassis + pack.assemblies + pack.wheels}
        all_sources.append(Source('brickpack', pack.id, None, rewards))
        for reward in rewards:
            sources_for_any_id[reward].append(all_sources[-1])
add_brickpacks_to_sources()
#print(all_sources)
dump("sources", all_sources)
dump("sources_for_any_id", sources_for_any_id)



@dataclass
class Brick:
    id: int
    aliases: list[int]
    name: str
    no_image: bool
    size: tuple[int]
    weight: float
    is_surplus: bool
    n_usage: int
    sources: list

def check_brick_icon_path(id, properties):
    if 'Icon' in properties:
        if properties["Icon"]["AssetPathName"] != f"/Game/LEGO/Bricks/T_{id}_Icon.T_{id}_Icon":
            print(f'brick {id} icon path differ from its id: {properties["Icon"]["AssetPathName"]}')
            other_id = int(properties["Icon"]["AssetPathName"].split('_')[-2])
            copy(brick_path + f"T_{other_id}_Icon.png", brick_path + f"T_{id}_Icon.png")
            print(f' | copyied {brick_path + f"T_{other_id}_Icon.png"} to {brick_path + f"T_{id}_Icon.png"}')
        return True
    else:
        #print('brick', id, f'have no icon path')
        if Path(brick_path + f"T_{id}_Icon.png").is_file():
            print(' | but icon exists anyway')
            return True
        else:
            return False

bricks = []
bricks_by_id = {}
brick_aliases = {}
def parse_bricks():
    for id, properties, oid in load(brick_path + "*.json", type='LegoPart'):
        id = int(id)
        assert properties["PartNumber"] == id, f'found id {properties["PartNumber"]}, expected {id}'
        name = get_name(properties, "PartName", default=str(id)) or '?'
        aliases = try_parse(properties, "Aliases", [])
        if id in aliases:
            aliases.remove(id)
        no_image = not check_brick_icon_path(id, properties)
        if not no_image:
            copy(brick_path + f"T_{id}_Icon.png", f'../textures/bricks/{id}.png')
        size = try_parse(properties, "GridSize", required=True)
        size = (size['X'], size['Y'], size['Z'])
        weight = try_parse(properties, "Mass", required=True)
        is_surplus = not try_parse(properties, "bIsInBrickPack", False)
        sources = sources_for_any_id.get(id, [])
        
        bricks.append(Brick(id, aliases, name, no_image, size, weight, is_surplus, n_usage=-1, sources=sources))
    
    bricks.sort(key=lambda brick: brick.id)
    
    for brick in bricks:
        bricks_by_id[brick.id] = brick

def map_aliases():
    # simple one-way alias->id mapping
    for brick in bricks:
        brick_aliases[brick.id] = brick.id
        for alias in brick.aliases:
            if alias not in brick_aliases:  # priority for the brick with the id
                brick_aliases[alias] = brick.id
    
    # recursivelly propagate aliases bidirectionally
    graph = {id: set(bricks_by_id[id].aliases) - set([id]) for id in bricks_by_id}
    aliases_groups = {}
    for brick in bricks:
        if brick.id not in aliases_groups:
            group = dfs(graph, brick.id)
            for id in group:
                aliases_groups[id] = group
            if len([alias for alias in group if alias in bricks_by_id and bricks_by_id[alias].sources]) > 1:
                print(group, {id: bricks_by_id[id].sources for id in group if id in bricks_by_id})
        brick.aliases = sorted(aliases_groups[brick.id] - set([brick.id]))

def dfs(graph: dict[Any, set], start):
    visited = set()
    stack = [start]
    while stack:
        vertex = stack.pop()
        if vertex not in visited:
            visited.add(vertex)
            if vertex not in graph:
                #print('neighbor', vertex, 'not in the graph; adding it')
                graph[vertex] = set()
            stack.extend(graph[vertex] - visited)
    return visited

parse_bricks()
map_aliases()

    
    
# dump('bricks', bricks)  # deferred to later
# dump('bricks_by_id', bricks_by_id)  # "
dump('brick_aliases', brick_aliases)
print(f'-> Found {len([b for b in bricks if b.is_surplus])} surplus-eligible bricks!')



@dataclass
class StatArchetype:
    id: str
    name: str
    stats: dict[float]
    rarity: str
    price: Optional[int]
    sources: list

stat_archetypes = []
stat_archetypes_by_id = {}
def parse_stat_archetypes():
    for id, properties, oid in load(base_path + "Game/Vehicle/Inventory/StatArchetypes/*.json", type='VehicleStatsArchetype'):
        name = get_name(properties, "ArchetypeName", required=True)
        stats = {"TopSpeed": 0, "Acceleration": 0, "Handling": 0, "Health": 0}
        for key, value in properties['PerformanceStats'].items():
            stats[key] = small_round(100 * value)
        rarity = try_parse(properties, "Rarity")
        price = try_parse(properties, "Price", None)
        sources = sources_for_any_id.get(oid, [])
        if 'Default' in id:
            sources.append(Source.default)
        stat_archetypes.append(StatArchetype(id, name, stats, rarity, price, sources))
        stat_archetypes_by_id[id] = stat_archetypes[-1]
parse_stat_archetypes()
dump('stat_archetypes', stat_archetypes)


#list_properties(base_path + 'Garage/LegoAssets/Stickers/*.json', detail=['DecorationType', 'bIsGarageAsset', 'Material', 'bCanMirror'])
#list_properties(base_path + 'LEGO/Decorations/**/*.json')

@dataclass
class Sticker:
    id: str
    name: str
    rarity: Optional[str]
    can_mirror: bool
    sources: list

stickers_by_id = {}
sheets_ids = set()
def parse_stickers():
    for id, properties, oid in chain(
        load(base_path + "Garage/LegoAssets/Stickers/*.json", type='LegoDecoration',
            remove_type_prefix='StickerGarage_'),
        load(base_path + "LEGO/Decorations/VC/Vehicles/*.json", type='LegoDecoration',
            remove_type_prefix='Deco_', n_per_file=None),  # n_per_file=None ignore the textures
        load(base_path + "LEGO/Decorations/Licensed/*/*.json", type='LegoDecoration',
            n_per_file=None)  # n_per_file=None ignore the textures
    ):
        name = get_name(properties, "DisplayName", required=True)
        rarity = try_parse(properties, "Rarity")
        can_mirror = try_parse(properties, "bCanMirror", default=False)
        image_path  = try_parse_image(properties, "Texture", required=True)
        if 'Grease_Monkey_Sign.png' in image_path:
            continue  # dev test sticker, let's skip it
        if do_uv_map and ('UVOffset' in properties or 'UVScale' in properties):
            new_image_path = Path(image_path).parent / '{id}.png'
            id = Path(image_path).stem + '/' + id
            name = Path(image_path).stem + '/' + name
            def xy(a): return a['X'], a['Y']
            u1, v1 = xy(properties['UVOffset']) if 'UVOffset' in properties else (0, 0)
            us, vs = xy(properties['UVScale']) if 'UVScale' in properties else (1, 1)
            u1, v1, us, vs = (float(e) for e in (u1, v1, us, vs))
            image = Image.open(image_path)
            uv_map_pil(image, u1, v1, us, vs).save(new_image_path)
            copy(new_image_path, f'../textures/stickers/{id}.png')
            copy(new_image_path, f'../textures/stickers/_/{id.replace("/", "_")}.png')
        else:
            copy(image_path, f'../textures/stickers/{id}.png')
        sources = sources_for_any_id.get(oid, [])
        if try_parse(properties, "AlwaysUnlocked", False):
            sources.append(Source.default)
        stickers_by_id[id] = Sticker(id, name, rarity, can_mirror, sources)
parse_stickers()
stickers_by_id = proper_sort_dict(stickers_by_id)
dump('stickers_by_id', stickers_by_id)



@dataclass
class Assembly:
    id: int
    name: str
    is_surplus: bool
    no_image: bool
    sources: list

@dataclass
class Wheel(Assembly):
    pass

@dataclass
class Propeller(Assembly):
    pass

def parse_assembly(id, properties, oid, out_texture_path, skip_image_paths=[]):
    name = get_name(properties, "AssemblyName", required=True)
    is_surplus =  not try_parse(properties, "bIsInBrickPack", False)
    #can_separate =  try_parse(properties, "bCanSeparate", False)
    #clusters =  try_parse(properties, "InseparableClusters", False)
    image_path  = try_parse_image(properties, "Icon")
    no_image = image_path is None or image_path in skip_image_paths
    if no_image:
        pass #print(id, ':', name, 'have no image')
    else:
        copy(image_path, out_texture_path + f'{id}.png')
    sources = sources_for_any_id.get(oid, [])
    if try_parse(properties, "AlwaysUnlocked", False):
        sources.append(Source.default)
    return Assembly(id, name, is_surplus, no_image, sources)

assemblies_by_id = {}
wheels_by_id = {}
propellers_by_id = {}
def parse_assemblies():
    for id, properties, oid in load(base_path + "LEGO/Assemblies/*.json", type='LegoAssembly'):
        assembly = parse_assembly(id, properties, oid, '../textures/assemblies/')
        assemblies_by_id[id] = assembly
def parse_wheels():
    for id, properties, oid in load(base_path + "LEGO/Wheel/*.json", type='LegoWheelAssembly'):
        assembly = parse_assembly(id, properties, oid, '../textures/wheels/')
        wheels_by_id[id] = Wheel(**assembly.__dict__)
def parse_propellers():
    for id, properties, oid in load(base_path + "LEGO/Propeller/*.json", type='LegoPropellerAssembly'):
        assembly = parse_assembly(id, properties, oid, '../textures/propellers/')
        propellers_by_id[id] = Propeller(**assembly.__dict__)
parse_assemblies()
parse_wheels()
parse_propellers()
assemblies_by_id = proper_sort_dict(assemblies_by_id)
wheels_by_id     = proper_sort_dict(wheels_by_id)
propellers_by_id = proper_sort_dict(propellers_by_id)
dump('assemblies_by_id', assemblies_by_id)
dump('wheels_by_id', wheels_by_id)
dump('propellers_by_id', propellers_by_id)



@dataclass
class Flair(Assembly):
    rarity: Optional[str]
    garage_cost: Optional[int]
    # sound: str

#list_properties(base_path + 'LEGO/Flair/*.json')

flairs_by_id = {}
def parse_flairs():
    for id, properties, oid in load(base_path + "LEGO/Flair/*.json", type='LegoFlairAssembly',
                               remove_type_prefix='Flair_', rename_ids={'JetTurbine_31074_REd': 'JetTurbine_31074_Red', 'Flair_Jetpack_Legend': 'Flair_JetPack_Legend'}):
        # skip a few problematics files
        if id in [
            'JeffOffroad_Jet',  # only reference a niagara (particle system), no other infos
        ]:
            continue
        
        assembly = parse_assembly(
            id, properties, oid, '../textures/flairs/',
            skip_image_paths=[
                '../Exports/LEGO2KDrive/Content/LEGO/Flair/T_Flair_Eye1_Icon.png'  # this one is referenced but don't exist for some reason
            ]
        )
        rarity = try_parse(properties, "Rarity")
        garage_cost = try_parse(properties, "GarageCost")
        
        name = assembly.name
        description = get_name(properties, "Description")
        if description is not None and description != name and name.startswith("Flair_"):
            print(f"| replaceing name '{name}' with description '{description}'")
            assembly.name = description
        
        flairs_by_id[id] = Flair(**assembly.__dict__, rarity=rarity, garage_cost=garage_cost)

parse_flairs()
flairs_by_id = proper_sort_dict(flairs_by_id)
dump('flairs_by_id', flairs_by_id)


# TODO

@dataclass
class Chassis(Assembly):
    front_wheels: str
    back_wheels: str

# TODO



@dataclass
class Chassis:
    id: str
    name: str  # only a few have these, we'll store the id otherwise
    # chassis_assembly: todo
    # properties: physics, not saving. however, we can use the path to identify the terrain type!
    terrain: str  # boat/street/offroad
    stats: Optional[dict[float]]
    default_engine: Optional[str]  # a lot have these
    # audio  (optional): prob collision noises, not saving  # a lot have these

# list_properties(base_path + "Game/Vehicle/Inventory/*ChassisConfigs/*.json", detail=['VehicleClass', 'ChassisPerformanceStats'])

chassis_by_id = {}
def parse_chassis():
    for id, properties, oid in load(base_path + "Game/Vehicle/Inventory/*ChassisConfigs/*.json", type='ChassisConfig'):
        name = get_name(properties, "ChassisName") or id
        default_engine = try_parse(properties, "DefaultEngineConfig")
        stats = try_parse(properties, "ChassisPerformanceStats")
        
        # chassis_properties_path = '../../' + try_parse(properties, "ChassisProperties", required=True)
        # cp_id, cp_properties = load(base_path + chassis_properties_path, type="ChassisProperties")[0]
        cp_id = try_parse(properties, "ChassisProperties", required=True)
        terrain_candidates = []
        for terrain in ['Street', 'Offroad', 'Boat']:
            if terrain.lower() in cp_id.lower():
                terrain_candidates.append(terrain)
        assert len(terrain_candidates) == 1, f'found {len(terrain_candidates)} possibilities, expected 1: {terrain_candidates}'
        terrain = terrain_candidates[0]
        
        chassis_by_id[id] = Chassis(id, name, terrain, stats, default_engine)
parse_chassis()
dump('chassis_by_id', chassis_by_id)



@dataclass
class Vehicle:
    id: str
    name: str
    rarity: Optional[str]
    license: Optional[str]
    n_surplus: int
    chassis: str
    terrain: str
    engine: Optional[str]
    horn: Optional[str]
    perk: Optional[str]
    stat_archetype: dict[float]
    archetype_stats: dict[float]
    additional_stats: dict[float]  # I think ?
    garage_valid: Optional[bool]
    weight_estimation: float
    weight_class_estimation: int
    sources: list

@dataclass
class VehicleParts:
    id: str
    name: str
    parts_and_colors: list

vehicles = []
vehicles_by_id = {}
vehicle_parts = []
v_ids_for_name = defaultdict(list)
brick_usage = {}
weights = {}
def parse_vehicles():
    for id, properties, oid in load(base_path + "Game/Vehicle/Configs/VehicleConfig_*.json", type='VehicleConfig'):
        #print(id)
        name = get_name(properties, "VehicleName", required=True)
        v_ids_for_name[name].append(id)
        rarity = try_parse(properties, "Rarity")
            
        assert id == Path(properties['PartGraph']['ObjectPath']).stem
        brickgraph_path = base_path + "Game/Vehicle/Configs/BrickGraphs/" + id + '.uexp'
        parts_and_colors = parse_vehicle_parts(brickgraph_path, verbose=0)
        parts = [p for (p, c) in parts_and_colors]
        colors = [c for (p, c) in parts_and_colors]
        surplus_parts = vehicle_surplus(parts)
        n_surplus = len(surplus_parts)
        for brick_id in parts:
            if brick_id not in brick_usage:
                brick_usage[brick_id] = set()
            brick_usage[brick_id].add(id)
        
        weight_estimation = sum(bricks_by_id[brick_aliases[i]].weight for i in parts)
        for i, threeshold in enumerate((1250, 2500, 4800, 8000, 11000, float('inf'))):
            if weight_estimation < threeshold:
                weight_class_estimation = i
                break
        weights[id] = (weight_estimation, weight_class_estimation)
        
        chassis = try_parse(properties, 'ChassisConfig', required=True).replace('ChassisConfig_', '', 1)
        chassis_name = chassis_by_id[chassis].name
        terrain = chassis_by_id[chassis].terrain
        engine = try_parse(properties, 'EngineConfig') or chassis_by_id[chassis].default_engine
        horn = try_parse(properties, 'HornOverride')  # TODO: find default horn
        perk = try_parse(properties, 'VehiclePerk')
        if perk is not None: perk = perk.split('Perk_')[1].removesuffix("_C")
        stat_archetype = try_parse(properties, 'StatArchetype')
        archetype_stats = stat_archetypes_by_id[stat_archetype].stats if stat_archetype is not None \
                          else {"TopSpeed": 0, "Acceleration": 0, "Handling": 0, "Health": 0}
        license = try_parse(properties, 'License')
        additional_stats = {"TopSpeed": 0, "Acceleration": 0, "Handling": 0, "Health": 0}
        if 'VehiclePerformanceStats' in properties:
            for stat, value in try_parse(properties, 'VehiclePerformanceStats', {}).items():
                additional_stats[stat] = small_round(100 * value)
        garage_valid = try_parse(properties, 'GarageValidation')
        sources = sources_for_any_id.get(id, [])
        if properties.get("bIsQuestVehicle", False):
            pass #print('| quest vehicle', id, 'have sources:', sources)
        if properties.get("bIsRivalVehicle", False):
            pass #print('| rival vehicle', id, 'have sources:', sources)
        if try_parse(properties, "AlwaysUnlocked", False):
            sources.append(Source.default)
            
        vehicles.append(Vehicle(id, name, rarity, license, n_surplus, chassis, terrain, engine, horn, perk, stat_archetype, archetype_stats, additional_stats, garage_valid, weight_estimation, weight_class_estimation, sources))
        vehicle_parts.append(VehicleParts(id, name, parts_and_colors))
        dump(
            'vehicle_parts/' + id,
            asdict(vehicles[-1]) | {'parts_and_colors': parts_and_colors},
            verbose=False
        )
    #todo: poids, "bDriverNeedsHeadgearOverride": false,

parse_vehicles()
dump('v_ids_for_name', v_ids_for_name)

vehicles, vehicle_parts = proper_sort_lists(vehicles, vehicle_parts)
vehicles_by_id = {v.id: v for v in vehicles}
brick_usage = {id: sorted(u, key=proper_order) for id, u in brick_usage.items()}
#dump('vehicles', vehicles)
dump('vehicles_by_id', vehicles_by_id)
dump('vehicle_parts', vehicle_parts)

dump('brick_usage', brick_usage)


for brick in bricks:
    dump(
        f'brick_usage/{brick.id}',
        asdict(brick) | {'usage': brick_usage.get(brick.id, [])},
        verbose=False
    )
    if brick.id in brick_usage:
        brick.n_usage = len(brick_usage[brick.id])
    else:
        brick.n_usage = 0
#dump('bricks', bricks)
dump('bricks_by_id', bricks_by_id)
