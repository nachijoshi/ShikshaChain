async function main() {
const ShikshaChain = await ethers.getContractFactory('ShikshaChain');
const sc = await ShikshaChain.deploy();
await sc.deployed();
console.log('ShikshaChain deployed to:', sc.address);
}


main()
.then(() => process.exit(0))
.catch((error) => {
console.error(error);
process.exit(1);
});