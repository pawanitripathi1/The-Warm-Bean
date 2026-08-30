function whichIsLarger(f, g) {
	let larger = ""
	
	if(f>g){
		larger = f;
	}
	else{
		larger = g;
	}
	return larger;
}

console.log(whichIsLarger(5,6))