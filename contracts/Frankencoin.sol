Todo: copy ERC20 stuff once I'm at a real computer again

address public governance;
private mapping address => uint256 minters;

applyForMinting(){
   minters[msg.sender] = block.timestamp + 2 weeks;
}

denyMinter(address minter) public governance{
  delete minters[minter];
}

modifier minteronly {
  require(block.timestamp > minters[msg.sender], "not an approved minter");
  _;
}

mint(address target, uint256 amount) external minterOnly{
   uint256 capital = balanceof(governance);
   required += (amount * IMinter(msg.sender).capitalRatio() / 100;
   require(capital >= required, "insufficient equity");
}

burn(address owner, uint256 amount) external minterOnly{
   _burn(owner, amount);
   required -= (amount * IMinter(msg.sender).capitalRatio() / 100;
}
