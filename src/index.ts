import { error } from 'console';

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

/**
 * Types:
 *  - defines a more meanigful name for this type
 *  - decalre the sha[pe of the type in a single place
 *  - import and exprt this type from modules, the same as if it were an importable/exportable value
 */

type Amount = { currency: string; value: number };

function printAmount(amt: Amount) {
  console.log(amt);

  const { currency, value } = amt;
  console.log(`${currency} : ${value}`);
}

const donation = {
  currency: 'INR',
  value: 120,
  description: "I have't decided yet",
};

printAmount(donation);

type UserInfoOutcomeError = readonly ['error', Error];
type UserInfoOutcomeSuccess = readonly [
  'success',
  { readonly name: string; readonly email: string },
];

type UserInfoOutCome = UserInfoOutcomeError | UserInfoOutcomeSuccess;

function maybeGetUserInfo2(): UserInfoOutCome {
  if (flipCoins() === 'heads') {
    return success;
  } else {
    return fail;
  }
}
