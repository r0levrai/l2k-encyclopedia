"""Extract parts numbers and colors from a vehicle brickgraph exported to raw .uexp"""

import json
from pathlib import Path
from glob import glob


base_path = "../Exports/LEGO2KDrive/Content/Game/Vehicle/Configs/BrickGraphs/"
max_bricks = 10000  # ignore arrays larger than this

brick_ids = set()
brick_aliases = {}
for path in glob("../Exports/LEGO2KDrive/Content/LEGO/Bricks/*.json"):
    filename = Path(path).stem
    if filename.isnumeric():
        brick_ids.add(int(filename))

        with open(path) as f:
            json_dict = [d for d in json.load(f) if d["Type"] == "LegoPart"]
            properties = json_dict[0]["Properties"]
            if 'Aliases' in properties and properties["Aliases"] is not None:
                for alias in properties["Aliases"]:
                    brick_aliases[alias] = int(filename)
brick_ids_or_aliases = brick_ids.union(brick_aliases.keys())


def read_int(file_bytes, start, end_excl, signed=False):
    return int.from_bytes(file_bytes[start : end_excl], byteorder='little', signed=signed)

def parse_vehicle_parts(brickgraph_path, verbose=1):
    """args: set verbose to 2 to print every brick"""
    with open(brickgraph_path, 'rb') as f:
        file_bytes = f.read()

    assert brickgraph_path.endswith('.uexp'), 'carefull not to use the .uasset ;)'


    SEEKING_NULLS = 0
    PARSING_ARRAY = 1
    
    candidates = []

    state = SEEKING_NULLS
    null_counts = 0
    array_start = None
    array_length = None
    bricks_and_colors = []
    for neg_offset in range(4):  # (*)
        for offset, byte in enumerate(file_bytes):
            if state == SEEKING_NULLS:
                """search for a 21 null bytes that precede the parts list"""
                if byte == 0:
                    null_counts += 1
                else:
                    offset -= neg_offset  # (*) in case the first brick_id (which is 4 bytes long)
                                          # beggins with 1 to 3 0x00, try up to 3 offsets to the left
                    if null_counts >= 21 and offset >= 53:
                        array_length = read_int(file_bytes, start=offset-53, end_excl=offset-53+4)
                        if (1 <= array_length <= max_bricks  # non essential check to limit excessive logging
                                and read_int(file_bytes, start=offset, end_excl=offset+4) in brick_ids_or_aliases):  # "
                            state = PARSING_ARRAY
                            array_start = offset
                            if verbose >= 1:
                                print("found potential array of size", array_length, "(in pieces) at", hex(offset))
                    null_counts = 0
            elif state == PARSING_ARRAY:
                """optimisticly parse as what we are searching for, but abort at any error"""
                if (offset - array_start) % 8 != 7:
                    continue
                brick_id = read_int(file_bytes, start=offset-7, end_excl=offset-3)
                color_id = read_int(file_bytes, start=offset-3, end_excl=offset+1)
                if brick_id in brick_ids_or_aliases:
                    bricks_and_colors.append((brick_id, color_id))
                    if verbose >= 2:
                        print(' |', brick_id)
                    if offset - array_start >= 8 * array_length - 1:
                        candidates.append(bricks_and_colors)
                        state = SEEKING_NULLS
                else:
                    if verbose >= 1:
                        print(' |', brick_id, 'is not a lego brick! aborting')
                    state = SEEKING_NULLS
                if state == SEEKING_NULLS:
                    array_start = None
                    array_length = None
                    bricks_and_colors = []
    assert len(candidates) > 0, 'Did not found any brick_and_colors arrays candidates'
    if len(candidates) > 1:
        print(f'Found {len(candidates)} brick_and_colors arrays candidates, returning the biggest')
        candidates.sort(key=lambda c: len(c), reverse=True)
    return candidates[0]

if __name__ == '__main__':
    brickgraph_path = base_path + "GreenMachine_VC000.uexp"  # "FF_Brian_NissanSkylineGTR.uexp"
    bricks_and_colors = parse_vehicle_parts(brickgraph_path)
    json_path = f"{Path(brickgraph_path).stem}_{len(bricks_and_colors)}_bricks.jsonl"
    with open(json_path, 'w') as f:
        json.dump(bricks_and_colors, f)
    print("successfuly parsed", len(bricks_and_colors), "bricks to", json_path)

# TODO: datamine color id list for validation