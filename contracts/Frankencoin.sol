Todo: copy ERC20 stuff once I'm at a real computer again


private mapping address => uint256 minters;

applyForMintingLicence(){
   minters[msg.sender] = block.timestamp + 2 weeks;
}

mint(address target, uint256 amount){
   require(block.timestamp > minters[msg.sender], "not an approved minter");

}
