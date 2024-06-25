function addTwo(num) {
    return num + 2;
}
function getUpper(val) {
    return val.toUpperCase();
}
function signUpUser(name, email, password) { }
var loginUser = function (name, email, isPaid) {
    if (isPaid === void 0) { isPaid = false; }
};
function getValue(myVal) {
    if (myVal > 5) {
        return true;
    }
    return "200 ok";
}
var getHello = function (s) {
    return "";
};
var heroes = ["batman", "spiderman", "ironman"];
// const heroes = [1, 2, 3];
heroes.map(function (hero) {
    return "hero is ".concat(hero);
});
function handleError(errmsg) {
    throw new Error(errmsg);
}
function consoleError(errmsg) {
    console.log(errmsg);
}
addTwo(2);
getUpper("al");
signUpUser("al", "al@chaiaurcode.com", false);
loginUser("al", "al@al.com");
