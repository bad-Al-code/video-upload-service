function addTwo(num: number): number {
  return num + 2;
}

function getUpper(val: string): string {
  return val.toUpperCase();
}

function signUpUser(name: string, email: string, password: boolean) {}

let loginUser = (name: string, email: string, isPaid: boolean = false) => {};

function getValue(myVal: number) {
  if (myVal > 5) {
    return true;
  }
  return "200 ok";
}

const getHello = (s: string): string => {
  return "";
};

const heroes = ["batman", "spiderman", "ironman"];
// const heroes = [1, 2, 3];

heroes.map((hero: string): string => {
  return `hero is ${hero}`;
});

function handleError(errmsg: string): never {
  throw new Error(errmsg);
}
function consoleError(errmsg: string): void {
  console.log(errmsg);
}

addTwo(2);
getUpper("al");

signUpUser("al", "al@chaiaurcode.com", false);

loginUser("al", "al@al.com");
