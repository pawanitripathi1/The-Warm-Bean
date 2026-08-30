function timeForMilkAndCookies(date){
    return date.getMonth() === 11 && date.getDate() === 24;
}

console.log(timeForMilkAndCookies(new Date(2025,11,24)))
console.log(timeForMilkAndCookies(new Date(20226,12,24)))