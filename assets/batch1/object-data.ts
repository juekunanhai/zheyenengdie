import type { ItemKind } from './item-system';

/** difficulty-r1 candidates: visible bearing geometry, contact cushioning and local plank support.
 * Formal source scale remains unchanged; candidate provenance is in preparation/design/difficulty-r1.
 * Materials remain calibration values, not final balance. */
export const UNITS_PER_METRE = 100;
export const PLATFORM_WIDTH = 160;
export const PLANNING_SECONDS = 4;
export const ENTER_SECONDS = .24;
export const STABLE_SECONDS = .65;
export const MAX_OBSERVE_SECONDS = 1.5;

export type ObjectKind = 'cardboard_box' | 'wood_plank' | 'basketball' | 'fridge' | 'toilet' | 'dumbbell' | 'wooden_crate' | 'ice_block' | 'sofa' | 'whale' | 'burger' | 'slipper'
    | 'television' | 'bathtub' | 'piano' | 'tire' | 'bowling_ball' | 'oil_drum' | 'spring_pad' | 'cat_bed' | 'giraffe' | 'ufo' | 'rocket' | 'vending_machine';
export interface ObjectSpec {
    kind: ObjectKind;
    width: number;
    height: number;
    circle: boolean;
    spriteWidth: number;
    spriteHeight: number;
    spriteOffset?: readonly [number, number];
    outline?: readonly (readonly [number, number])[];
    friction: number;
    restitution: number;
    density: number;
    contactAngularDamping?: number;
    adhesion?: { maxForce: number; maxTorque: number; maxImpactSpeed: number };
    /** Temporary strong-glue bond budget. Undefined keeps the original finite bond behavior. */
    adhesionSeconds?: number;
    /** First real support contact only; relative closing speed in Box2D metres/second. */
    contactImpactSpeed?: number;
    /** Total budget shared by at most two actual supports; angle error in degrees. */
    stabilizer?: { maxForce: number; maxTorque: number; maxImpactSpeed: number; maxAngleError: number };
    description?: string;
}
export const OBJECTS: Record<ObjectKind, ObjectSpec> = {
    cardboard_box: { kind: 'cardboard_box', width: 100.912779, height: 100, circle: false,
        spriteWidth: 102.636917, spriteHeight: 101.926978, spriteOffset: [0.05071,-0.05071],
        outline: [
            [-50.456389,39.858012], [-50.456389,-46.957404], [-47.413793,-50],
            [47.413793,-50], [50.456389,-46.957404], [50.456389,39.858012],
            [39.908722,50], [-37.576065,50],
        ],
        friction: 0.65, restitution: 0.02, density: 0.45115949058,
        contactAngularDamping: 6,
        contactImpactSpeed: 2.4,
    },
    wood_plank: { kind: 'wood_plank', width: 260, height: 28.744805, circle: false,
        spriteWidth: 263.674148, spriteHeight: 32.851205, spriteOffset: [0.108063,-0.108063],
        outline: [
            [-130,8.536991], [-130,-10.049875], [-125.029094,-14.372402],
            [125.029094,-14.372402], [130,-10.049875], [130,8.536991],
            [124.596841,14.372402], [-124.596841,14.372402],
        ],
        friction: 0.65, restitution: 0.02, density: 0.481043899512,
        contactAngularDamping: 6,
        contactImpactSpeed: 2.4,
        stabilizer: {"maxForce":420,"maxTorque":95,"maxImpactSpeed":1.8,"maxAngleError":12},
        description: "搭上一块稳固板，上下都踏实一点。",
    },
    basketball: { kind: 'basketball', width: 68, height: 68, circle: true,
        spriteWidth: 70.2295, spriteHeight: 70.2295,
        friction: 0.85, restitution: 0.03, density: 0.4,
        contactAngularDamping: 6,
        adhesion: {"maxForce":1500,"maxTorque":150,"maxImpactSpeed":2},
        description: "别担心，有人给它贴了双面胶。",
    },
    fridge: { kind: 'fridge', width: 150, height: 167.554858636, circle: false,
        spriteWidth: 152.664576818, spriteHeight: 170.219435455, spriteOffset: [0.078369545,-0.078369545],
        outline: [
            [-74.843259545,65.909090455], [-75,-65.125392273], [-57.601880455,-83.77743],
            [57.445141364,-83.77743], [75,-66.065830909], [74.843259545,66.22257],
            [57.288400909,83.77743], [-57.601880455,83.77743],
        ],
        friction: 0.6, restitution: 0.01, density: 0.293776465351,
        contactAngularDamping: 6,
        contactImpactSpeed: 2.4,
    },
    toilet: { kind: 'toilet', width: 150.900515, height: 115, circle: false,
        spriteWidth: 154.64837, spriteHeight: 118.5506, spriteOffset: [0.098628,0],
        outline: [
            [-74.266724,54.738422], [-75.450257,51.582333], [-74.858491,46.848199],
            [-72.096913,44.875643], [-70.518868,18.837907], [-67.165523,-1.084906],
            [-63.417667,-7.791595], [-57.697256,-9.764151], [-52.174099,-16.668096],
            [-48.031732,-22.191252], [-46.256432,-28.897942], [-47.637221,-34.421098],
            [-50.596055,-40.141509], [-56.119211,-44.678388], [-63.023156,-47.834477],
            [-66.573756,-51.187822], [-67.75729,-55.921955], [-64.601201,-57.5],
            [64.009434,-57.5], [67.362779,-54.541166], [65.192967,-49.01801],
            [59.078045,-45.46741], [56.316467,-41.127787], [54.738422,-35.21012],
            [56.513722,-32.054031], [63.417667,-28.503431], [68.546312,-24.163808],
            [72.294168,-17.654374], [74.463979,-9.566895], [75.450257,-1.282161],
            [73.280446,2.465695], [67.560034,4.43825], [24.95283,4.43825],
            [22.585763,4.240995], [24.95283,45.861921], [27.517153,47.24271],
            [28.108919,51.779588], [26.925386,55.330189], [21.993997,57.5],
            [-68.940823,57.5],
        ],
        friction: 0.62, restitution: 0.015, density: 0.401990728786,
        contactAngularDamping: 6,
        contactImpactSpeed: 2.4,
    },
    dumbbell: { kind: 'dumbbell', width: 147.939914, height: 45, circle: false,
        spriteWidth: 151.416309, spriteHeight: 48.476395, spriteOffset: [0,0],
        outline: [
            [-67.982833,17.285408], [-70.493562,11.491416], [-73.969957,9.560086],
            [-73.969957,-9.946352], [-70.493562,-11.684549], [-67.982833,-17.478541],
            [-62.76824,-22.5], [-35.729614,-22.5], [-31.287554,-18.05794],
            [-28.969957,-11.298283], [-26.652361,-8.401288], [-22.982833,-7.049356],
            [22.7897,-7.049356], [26.652361,-8.401288], [28.390558,-11.298283],
            [30.515021,-17.478541], [35.729614,-22.5], [62.961373,-22.5],
            [68.175966,-17.478541], [70.493562,-12.070815], [73.969957,-9.946352],
            [73.969957,9.560086], [70.493562,11.298283], [67.7897,17.285408],
            [62.961373,22.5], [35.729614,22.5], [30.901288,17.671674],
            [28.583691,12.070815], [26.652361,8.787554], [22.7897,7.049356],
            [-22.982833,7.049356], [-25.686695,8.208155], [-28.583691,11.10515],
            [-30.321888,17.092275], [-35.729614,22.5], [-62.76824,22.5],
        ],
        friction: 0.72, restitution: 0.015, density: 1.1,
        contactAngularDamping: 6,
        contactImpactSpeed: 2.4,
    },
    wooden_crate: { kind: 'wooden_crate', width: 120.0, height: 110.143416, circle: false,
        spriteWidth: 122.659713, spriteHeight: 112.803129, spriteOffset: [0.078227, -0.078227],
        outline: [
            [-59.530639,49.28292], [-60.0,35.984355], [-58.435463,33.637549],
            [-58.435463,-34.576271], [-60.0,-37.392438], [-60.0,-50.847458],
            [-57.340287,-54.445893], [-55.77575,-55.071708], [-42.946545,-55.071708],
            [-41.225554,-54.132986], [41.382008,-54.132986], [42.946545,-55.071708],
            [55.932203,-55.071708], [59.687093,-52.099087], [60.0,-37.079531],
            [58.435463,-34.576271], [58.435463,33.637549], [60.0,35.514993],
            [60.0,48.344198], [54.211213,54.602347], [39.973924,54.915254],
            [38.878748,53.820078], [-38.722295,53.820078], [-39.817471,54.915254],
            [-52.333768,55.071708], [-54.367666,54.445893],
        ],
        friction: 0.68, restitution: 0.01, density: 0.385401841055,
        contactAngularDamping: 6, contactImpactSpeed: 2.4,
    },
    ice_block: { kind: 'ice_block', width: 119.687093, height: 77.444589, circle: false,
        spriteWidth: 122.659713, spriteHeight: 80.41721, spriteOffset: [0.078227, -0.078227],
        outline: [
            [-58.122555,30.11734], [-59.843546,24.954368], [-59.843546,-26.831812],
            [-56.714472,-34.028683], [-52.490222,-37.314211], [-48.735332,-38.565841],
            [46.857888,-38.722295], [53.428944,-36.84485], [57.653194,-32.777053],
            [59.843546,-26.675359], [59.843546,25.110821], [57.183833,31.681877],
            [51.238592,37.157757], [46.701434,38.565841], [-45.606258,38.722295],
            [-49.361147,37.940026], [-53.585398,35.59322],
        ],
        friction: 0.3, restitution: 0.01, density: 0.508738237677,
        contactAngularDamping: 6, contactImpactSpeed: 2.4,
    },
    sofa: { kind: 'sofa', width: 180.0, height: 81.66884, circle: false,
        spriteWidth: 183.98957, spriteHeight: 85.658409, spriteOffset: [0.11734, -0.11734],
        outline: [
            [-89.530639,7.040417], [-90.0,-13.142112], [-89.061278,-34.498044],
            [-87.887875,-38.252934], [-84.367666,-40.599739], [-71.460235,-40.83442],
            [-68.174707,-39.426336], [-65.123859,-40.83442], [65.123859,-40.83442],
            [68.409387,-39.426336], [71.225554,-40.83442], [82.724902,-40.83442],
            [86.479791,-39.661017], [88.826597,-35.671447], [90.0,-9.621904],
            [90.0,4.693611], [88.826597,8.683181], [83.898305,12.907432],
            [73.57236,18.539765], [60.899609,19.009126], [60.430248,28.161669],
            [59.256845,33.559322], [56.440678,37.548892], [50.808344,40.130378],
            [40.013038,40.83442], [10.912647,40.599739], [3.402868,39.191656],
            [0.352021,36.610169], [-2.933507,39.426336], [-12.32073,40.83442],
            [-38.604954,40.83442], [-51.277705,39.661017], [-55.736636,37.548892],
            [-59.022164,33.089961], [-60.430248,26.518905], [-60.899609,19.009126],
            [-71.694915,19.009126], [-74.511082,18.070404], [-86.01043,11.499348],
            [-88.357236,9.387223],
        ],
        friction: 0.8, restitution: 0.01, density: 0.329983425303,
        contactAngularDamping: 6, contactImpactSpeed: 2.4,
    },
    whale: { kind: 'whale', width: 225.0, height: 96.512386, circle: false,
        spriteWidth: 229.986962, spriteHeight: 101.499348, spriteOffset: [0.146675, -0.146675],
        outline: [
            [-112.5,-8.360495], [-108.39309,-21.854628], [-102.819426,-30.068449],
            [-97.245763,-35.348761], [-92.845502,-38.282269], [-84.925033,-42.095828],
            [-76.417862,-44.735984], [-58.523468,-47.376141], [-36.815515,-48.256193],
            [0.146675,-48.256193], [34.468709,-46.496089], [43.269231,-45.029335],
            [52.363103,-42.389179], [61.750326,-37.988918], [67.32399,-34.175359],
            [74.071056,-28.014993], [77.884615,-23.321382], [81.404824,-17.747718],
            [82.871578,-13.640808], [84.631682,-11.880704], [89.911995,-11.294003],
            [97.539113,-8.653846], [106.046284,-2.20013], [109.273142,2.20013],
            [111.326597,6.600391], [112.5,11.000652], [112.5,15.107562],
            [109.859844,19.801173], [102.819426,22.147979], [96.07236,21.267927],
            [89.031943,17.454368], [86.978488,23.028031], [82.284876,28.308344],
            [75.83116,31.535202], [69.964146,31.535202], [67.61734,30.361799],
            [65.270535,27.721643], [63.21708,21.267927], [63.51043,15.987614],
            [64.683833,12.174055], [67.910691,6.30704], [71.137549,2.786832],
            [68.204042,2.493481], [65.270535,3.666884], [62.337027,6.600391],
            [52.949804,23.614733], [45.322686,32.415254], [38.575619,37.402216],
            [28.014993,42.389179], [18.33442,45.029335], [1.613429,47.376141],
            [-14.52086,48.256193], [-36.522164,48.256193], [-51.776402,47.376141],
            [-63.51043,45.616037], [-75.244459,42.389179], [-86.098435,37.108866],
            [-94.312256,30.948501], [-101.646023,23.321382], [-108.39309,12.760756],
            [-111.913299,1.613429],
        ],
        friction: 0.72, restitution: 0.01, density: 0.421008967097,
        contactAngularDamping: 6, contactImpactSpeed: 2.4,
    },
    burger: { kind: 'burger', width: 130.0, height: 103.636364, circle: false,
        spriteWidth: 138.181818, spriteHeight: 111.363636, spriteOffset: [0.454545, -0.227273],
        outline: [
            [-54.545455,42.272727], [-58.636364,35.0], [-59.545455,31.363636],
            [-61.363636,30.0], [-63.181818,26.363636], [-62.727273,22.727273],
            [-60.0,19.090909], [-62.727273,15.909091], [-64.545455,12.272727],
            [-65.0,8.636364], [-63.181818,5.454545], [-58.181818,4.090909],
            [-62.272727,-2.727273], [-63.636364,-9.090909], [-63.181818,-10.454545],
            [-61.363636,-11.818182], [-59.090909,-10.909091], [-58.181818,-11.363636],
            [-57.727273,-15.454545], [-60.909091,-20.454545], [-61.363636,-23.181818],
            [-60.454545,-25.909091], [-57.727273,-28.181818], [-58.181818,-32.727273],
            [-56.363636,-40.0], [-51.363636,-45.909091], [-40.0,-51.818182],
            [40.909091,-51.818182], [52.727273,-45.454545], [55.454545,-42.727273],
            [58.636364,-36.818182], [59.545455,-33.181818], [59.545455,-27.727273],
            [62.272727,-24.545455], [62.272727,-20.454545], [60.0,-15.454545],
            [60.909091,-8.181818], [63.636364,-7.727273], [65.0,-5.909091],
            [65.0,-1.818182], [64.090909,0.909091], [59.090909,8.636364],
            [60.0,13.636364], [63.636364,17.272727], [64.090909,21.818182],
            [61.818182,26.363636], [58.636364,29.545455], [57.272727,34.545455],
            [54.545455,40.0], [47.727273,47.727273], [43.181818,50.454545],
            [40.454545,50.454545], [39.545455,51.363636], [36.818182,51.818182],
            [-39.545455,51.818182], [-40.454545,50.909091], [-45.454545,50.454545],
            [-51.363636,45.909091],
        ],
        friction: 0.8, restitution: 0.01, density: 0.271579711642,
        contactAngularDamping: 6, contactImpactSpeed: 2.4,
    },
    slipper: { kind: 'slipper', width: 165.0, height: 92.082153, circle: false,
        spriteWidth: 174.348442, spriteHeight: 101.898017, spriteOffset: [0.0, -0.233711],
        outline: [
            [82.032578,3.038244], [80.16289,8.179887], [75.488669,16.593484],
            [70.347025,22.20255], [65.205382,25.941926], [57.259207,29.681303],
            [51.18272,31.083569], [45.573654,33.888102], [35.290368,37.627479],
            [30.616147,38.562323], [26.876771,40.432011], [23.137394,40.899433],
            [6.310198,46.041076], [-1.168555,46.041076], [-4.44051,45.106232],
            [-9.114731,42.3017], [-14.723796,36.692635], [-17.995751,32.018414],
            [-32.953258,34.355524], [-45.573654,34.355524], [-54.922096,32.018414],
            [-63.803116,27.811615], [-72.216714,21.267705], [-75.488669,17.528329],
            [-79.695467,10.516997], [-82.032578,3.505666], [-82.5,-7.712465],
            [-80.630312,-17.060907], [-76.890935,-25.007082], [-73.61898,-28.746459],
            [-66.607649,-33.42068], [-61.466006,-35.290368], [-44.171388,-39.497167],
            [-20.332861,-43.236544], [4.907932,-46.041076], [24.072238,-46.041076],
            [33.888102,-45.106232], [48.378187,-41.366856], [60.531161,-35.75779],
            [71.28187,-27.811615], [76.423513,-21.735127], [81.097734,-13.32153],
            [82.5,-7.245042],
        ],
        friction: 0.8, restitution: 0.01, density: 0.245651470001,
        contactAngularDamping: 6, contactImpactSpeed: 2.4,
    },
    television: { kind: 'television', width: 105, height: 90, circle: false,
        spriteWidth: 105, spriteHeight: 102, outline: [[-52.5,-45], [52.5,-45], [52.5,45], [-52.5,45]],
        friction: 0.62, restitution: 0.01, density: 0.42, contactAngularDamping: 6, contactImpactSpeed: 2.4,
        description: '天线先落地，屏幕随后保持平衡。' },
    bathtub: { kind: 'bathtub', width: 155, height: 72, circle: false,
        spriteWidth: 155, spriteHeight: 138, outline: [[-77.5,15], [-68,31], [58,30], [77.5,12], [69,-31], [-58,-31]],
        friction: 0.68, restitution: 0.01, density: 0.34, contactAngularDamping: 6, contactImpactSpeed: 2.4,
        description: '宽而浅的浴缸，适合承接下一件重物。' },
    piano: { kind: 'piano', width: 165, height: 110, circle: false,
        spriteWidth: 165, spriteHeight: 154, outline: [[-82.5,-55], [82.5,-55], [82.5,35], [55,55], [-55,55], [-82.5,35]],
        friction: 0.72, restitution: 0.01, density: 0.62, contactAngularDamping: 6, contactImpactSpeed: 2.4,
        description: '沉重的琴身，落稳后会成为可靠底座。' },
    tire: { kind: 'tire', width: 95, height: 95, circle: true,
        spriteWidth: 95, spriteHeight: 80, friction: 0.88, restitution: 0.02, density: 0.46,
        adhesion: { maxForce: 900, maxTorque: 110, maxImpactSpeed: 2.1 }, contactAngularDamping: 6,
        description: '圆滚滚的轮胎，接触时容易继续滚动。' },
    bowling_ball: { kind: 'bowling_ball', width: 62, height: 62, circle: true,
        spriteWidth: 62, spriteHeight: 72, friction: 0.5, restitution: 0.03, density: 1.08,
        contactAngularDamping: 5, contactImpactSpeed: 2.4, description: '小而重的球，落点偏一点就会改变整座塔。' },
    oil_drum: { kind: 'oil_drum', width: 72, height: 112, circle: false,
        spriteWidth: 72, spriteHeight: 72, outline: [[-34,-56], [34,-56], [36,-47], [36,47], [30,56], [-30,56], [-36,47], [-36,-47]],
        friction: 0.58, restitution: 0.01, density: 0.72, contactAngularDamping: 6, contactImpactSpeed: 2.4,
        description: '窄而高的油桶，垂直姿态更容易站稳。' },
    spring_pad: { kind: 'spring_pad', width: 90, height: 72, circle: false,
        spriteWidth: 90, spriteHeight: 90, outline: [[-45,-36], [45,-36], [45,20], [34,36], [-34,36], [-45,20]],
        friction: 0.74, restitution: 0.08, density: 0.3, contactAngularDamping: 5, contactImpactSpeed: 2.1,
        description: '弹簧垫会回弹，释放时留出一点缓冲。' },
    cat_bed: { kind: 'cat_bed', width: 120, height: 55, circle: false,
        spriteWidth: 120, spriteHeight: 128, outline: [[-60,-27.5], [60,-27.5], [60,8], [46,27.5], [-46,27.5], [-60,8]],
        friction: 0.86, restitution: 0.01, density: 0.27, contactAngularDamping: 6, contactImpactSpeed: 2.4,
        description: '软乎乎的猫窝，横放时提供很宽的承托面。' },
    giraffe: { kind: 'giraffe', width: 75, height: 205, circle: false,
        spriteWidth: 75, spriteHeight: 73, outline: [[-25,-102.5], [25,-102.5], [37,-57], [28,102.5], [-28,102.5], [-37,-57]],
        friction: 0.68, restitution: 0.01, density: 0.3, contactAngularDamping: 6, contactImpactSpeed: 2.4,
        description: '长颈鹿把重心抬高，落点要更仔细。' },
    ufo: { kind: 'ufo', width: 170, height: 62, circle: false,
        spriteWidth: 170, spriteHeight: 148, outline: [[-85,0], [-65,22], [0,31], [65,22], [85,0], [65,-22], [0,-31], [-65,-22]],
        friction: 0.7, restitution: 0.02, density: 0.28, contactAngularDamping: 5, contactImpactSpeed: 2.4,
        description: '扁平的 UFO，能做成横跨两点的桥。' },
    rocket: { kind: 'rocket', width: 78, height: 175, circle: false,
        spriteWidth: 78, spriteHeight: 85, outline: [[0,87.5], [35,46], [39,-55], [22,-87.5], [-22,-87.5], [-39,-55], [-35,46]],
        friction: 0.62, restitution: 0.02, density: 0.36, contactAngularDamping: 5, contactImpactSpeed: 2.4,
        description: '火箭很高，旋转后会立刻改变占位高度。' },
    vending_machine: { kind: 'vending_machine', width: 92, height: 155, circle: false,
        spriteWidth: 92, spriteHeight: 97, outline: [[-46,-77.5], [46,-77.5], [46,67], [35,77.5], [-35,77.5], [-46,67]],
        friction: 0.64, restitution: 0.01, density: 0.5, contactAngularDamping: 6, contactImpactSpeed: 2.4,
        description: '自动贩卖机又高又重，适合在稳定阶段出现。' },
};
// Fixed opening: the director takes over only after these fourteen advertised turns.
export const CALIBRATION_SEQUENCE: readonly ObjectKind[] = ["cardboard_box", "wood_plank", "fridge", "wooden_crate", "sofa", "whale", "wood_plank", "burger", "ice_block", "dumbbell", "wood_plank", "toilet", "slipper", "basketball"];

export function halfExtents(spec: ObjectSpec, angle: number): { x: number; y: number } {
    if (spec.circle) return { x: spec.width / 2, y: spec.height / 2 };
    const a = angle * Math.PI / 180;
    const c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
    return { x: (spec.width * c + spec.height * s) / 2, y: (spec.width * s + spec.height * c) / 2 };
}

/** Actual rotated support outline; the rectangle remains only the nominal size envelope. */
export function localBounds(spec: ObjectSpec, angle: number): { left: number; right: number; bottom: number; top: number } {
    if (!spec.outline) {
        const half = halfExtents(spec, angle);
        return { left: -half.x, right: half.x, bottom: -half.y, top: half.y };
    }
    const a = angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const xs = spec.outline.map(([x, y]) => x * c - y * s);
    const ys = spec.outline.map(([x, y]) => x * s + y * c);
    return { left: Math.min(...xs), right: Math.max(...xs), bottom: Math.min(...ys), top: Math.max(...ys) };
}

/** Planar angle avoids the alternative XYZ Euler branch around half turns. */
export function planarAngle(q: { z: number; w: number }): number {
    return Math.atan2(2 * q.w * q.z, 1 - 2 * q.z * q.z) * 180 / Math.PI;
}

export type RunPhase = 'entering' | 'planning' | 'falling' | 'observing' | 'incident' | 'defeated' | 'ended';
export const runResult = {
    runId: '', height: 0, placed: 0, reason: 'calibration_end', technicalScore: 0, newRecord: false,
    collectionNewObjects: [] as ObjectKind[], collectionNewItems: [] as ItemKind[],
    highlights: { narrow_escape: 0, edge_balance: 0, bridge: 0, large_rescue: 0 },
};
