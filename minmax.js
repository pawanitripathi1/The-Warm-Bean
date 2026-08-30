function minMax(arr) {
	const min1 = Math.min(...arr)
	const max1 = Math.max(...arr)
	return [min1,max1]
	
}

console.log(minMax([2,3,6,7]))			