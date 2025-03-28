interface Car {
  make: string;
  model: string;
  year: number;
  chargeVoltage?: number;
}

function printCar(car: Car) {
  let str = `${car.make} ${car.model} ${car.year}`;

  if (typeof car.chargeVoltage !== 'undefined')
    str += `// ${car.chargeVoltage}v`;

  console.log(str);
}

printCar({
  make: 'Tesla',
  model: 'Model 4',
  year: 2025,
  chargeVoltage: 220,
});

interface Phone {
  [k: string]: {
    country: string;
    area: string;
    number: string;
  };
}

const phones: Phone = {
  home: { country: '+91', area: '110021', number: '912-123-1233' },
  work: { country: '+91', area: '210021', number: '912-123-1233' },
  fax: { country: '+91', area: '1230021', number: '912-123-1233' },
};

console.log(phones.work.area);

// Tuples
let myCar = [2020, 'Tesla', 'CarName'];
const [year, make, model] = myCar;

type OneThroughFive = 1 | 2 | 3 | 4 | 5;
type Even = 2 | 4 | 6 | 8;

let evenOrLowNumber = 5 as Even | OneThroughFive;

function flipCoins() {
  if (Math.random() > 0.5) return 'heads';
  return 'tails';
}

const coinOutcome = flipCoins();

const success = ['success', { name: 'Al', email: 'al@al.com' }] as const;
const fail = ['error', new Error('Something went wrong')] as const;

function maybeGetUserInfo() {
  if (flipCoins() === 'heads') {
    return success;
  } else {
    return fail;
  }
}

const outcome2 = maybeGetUserInfo();
const [first, second] = outcome2;

if (second instanceof Error) {
  second;
} else {
  second;
}
