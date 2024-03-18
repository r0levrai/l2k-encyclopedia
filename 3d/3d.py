from math import cos, sin
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
import json
from shutil import copyfileobj
from zipfile import ZipFile

import numpy as np
from scipy.spatial.transform import Rotation

from vehicle_parts import parse_vehicle_parts



def xyz(dict_):
    return dict_["X"], dict_["Y"], dict_["Z"]

def xyzw(dict_):
    return dict_["X"], dict_["Y"], dict_["Z"], dict_["W"]

'''
def uetransform_to_matrix(dict_):
    # transform components
    sx, sy, sz = xyz(dict_["Scale3D"])
    tx, ty, tz = xyz(dict_["Translation"])
    qx, qy, qz, qw = xyzw(dict_["Rotation"])
    # normalize quaternion
    qn = 1 / (qx*qx + qy*qy + qz*qz + qw*qw) ** 0.5
    qx, qy, qz, qw = (q * qn for q in (qx, qy, qz, qw))
    # matrixes
    sm = np.array([
        [sx, 0, 0, 0],
        [0, sy, 0, 0],
        [0, 0, sz, 0],
        [0, 0, 0,  1]
    ])
    tm = np.array([
        [1, 0, 0, tx],
        [0, 1, 0, ty],
        [0, 0, 1, tz],
        [0, 0, 0,  1]
    ])
    rm = np.eye(4)  # identity
    rm[:3, :3] = Rotation.from_quat([qx, qy, qz, qw]).as_matrix()
    return sm @ rm @ tm
'''
def change_base(x, y, z):
    # from docs: LDraw: -Y up, Z forward, X right; unreal: X forward, Z up, Y ?
    # empiricaly: LDraw: -Y up, X forward, -Z right; unreal: X forward, Z up, Y right
    return (x, -z, -y)

def uetransform_to_ldraw(dict_):
    # transform components
    sx, sy, sz = xyz(dict_["Scale3D"])
    #sx, sy, sz = change_base(sx, sy, sz)  # it's worse?
    tx, ty, tz = change_base(*xyz(dict_["Translation"]))
    qx, qy, qz, qw = xyzw(dict_["Rotation"])
    
    qx, qy, qz = change_base(qx, qy, qz)
    qx, qy, qz = -qx, -qy, -qz  # invert rotation from left-handed coord system
    # normalize quaternion
    qn = 1 / (qx*qx + qy*qy + qz*qz + qw*qw) ** 0.5
    qx, qy, qz, qw = (q * qn for q in (qx, qy, qz, qw))

    #'''manual version:
    # matrixes
    sm = np.array([
        [sx, 0, 0],
        [0, sy, 0],
        [0, 0, sz]
    ])
    rm = Rotation.from_quat([qx, qy, qz, qw]).as_matrix()
    srm = sm @ rm

    '''version adapted from UE source code: https://github.com/EpicGames/UnrealEngine/blob/072300df18a94f18077ca20a14224b5d99fee872/Engine/Source/Runtime/Core/Public/Math/TransformNonVectorized.h#L249
    srm = np.array([
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
    ])

    srm[0][0] = sx * (1 - 2*(qy**2 + qz**2))
    srm[1][1] = sy * (1 - 2*(qx**2 + qz**2))
    srm[2][2] = sz * (1 - 2*(qx**2 + qy**2))

    srm[2][1] = sz * 2*(qy*qz - qw*qx)
    srm[1][2] = sy * 2*(qy*qz + qw*qx)

    srm[1][0] = sy * 2*(qx*qy - qw*qz)
    srm[0][1] = sx * 2*(qx*qy + qw*qz)

    srm[2][0] = sz * 2*(qx*qz + qw*qy)
    srm[0][2] = sx * 2*(qx*qz - qw*qy)
    srm = np.transpose(srm)
    srm = srm @ np.array([
        [ 1,  0,  0],  #  x
        [ 0,  0, -1],  # -z
        [ 0, -1,  0],  # -y
    ])
    '''

    #print(tx, ty, tz)
    return ' '.join(str(e) for e in [tx*4/5, ty*4/5, tz*4/5] + [e for line in srm for e in line])

def load(path, type="LegoPartGraphAsset", n_per_file=1):
    with open(path, encoding='utf-8') as f:
        json_dicts = [uecomponent for uecomponent in json.load(f) if uecomponent["Type"] == type]
        if n_per_file is not None:
            assert len(json_dicts) == n_per_file, f'found {len(json_dicts)} {type} in file {id}, expected {n_per_file}'
        return json_dicts[0]

def convert(in_path, out_path, parts_zip_path, parts_dir_path):
    bricks_and_colors = parse_vehicle_parts(in_path + '.uexp')
    transforms = load(in_path + '.json')["Properties"]["Graph"]["PartTransforms"]
    with open(out_path, 'w', encoding='utf-8') as f:
        for (brick_id, color), transform in zip(bricks_and_colors, transforms):
            unzip_needed_part(parts_zip_path, parts_dir_path, f"{brick_id}.dat")
            line = f"1 {color} {uetransform_to_ldraw(transform)} {brick_id}.dat"
            print(line, file=f)
            #print(line)
    print("converted", len(bricks_and_colors), "bricks to", out_path)

@lru_cache
def get_zippaths(zip_path):
    """return a dict of {part_filename: full_path_in_the_zip}
    we cache it since this is O(n_files_in_zip) and used a for each vehicle piece."""
    zippaths = defaultdict(list)
    with ZipFile(zip_path) as parts_zip:
        for p in parts_zip.filelist:
            zippaths[Path(p.filename).name].append(p.filename)
    return zippaths

def unzip_needed_part(zip_path, dir_path, part_name, depth=0):
    for zippath in get_zippaths(zip_path)[part_name]:
        out_path = Path(dir_path) / zippath.replace('ldraw/parts/', '').replace('ldraw/p/', '')
        if out_path.is_file():
            continue
        #print(' |'*(depth+1), 'unzipping', Path(zip_path) / zippath, 'to', out_path)
        print(' |'*(depth+1), 'unzipping', zippath)
        out_path.parents[0].mkdir(parents=True, exist_ok=True)
        with ZipFile(zip_path) as parts_zip:
            with (parts_zip.open(zippath) as in_file, open(out_path, 'wb') as out_file):
                copyfileobj(in_file, out_file)
        # recursively unzip dependencies
        deps = set()
        with open(out_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('1'):  # load sub-file instruction
                    deps.add(line.split()[-1])
        for dep in deps:
            unzip_needed_part(zip_path, dir_path, dep, depth+1)

if __name__ == '__main__':
    vehicle_id = "Bajambug_VC000"

    base_path = "../Exports/LEGO2KDrive/Content/"
    parts_zip_path = '../dependencies/buildinginstructions.js/ldraw_parts_complete.zip'
    parts_dir_path = '../dependencies/buildinginstructions.js/ldraw_parts'

    in_path = base_path + "Game/Vehicle/Configs/BrickGraphs/" + vehicle_id
    out_path = 'vehicles/' + vehicle_id + '.ldr'
    convert(in_path, out_path, parts_zip_path, parts_dir_path)
