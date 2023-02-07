pragma solidity 0.4.24;

import "@goplugin/contracts/src/v0.4/vendor/Ownable.sol";
import "@goplugin/contracts/src/v0.4/PluginClient.sol";
import "@goplugin/contracts/src/v0.4/vendor/SafeMathPlugin.sol";


contract InternalContract is PluginClient, Ownable {
  using SafeMathPlugin for uint256;
  
  address private constant REGISTRARADDRESS=address(0xeF0eef30A645Aa9c39D4383321cCc0DF906ff12c); //DO NOT REMOVE THIS
  uint256 private constant REGISTRARFEE = 0.0001 * 10**18;   //DO NOT REMOVE THIS
  //Initialize Oracle Payment     
  uint256 public ORACLE_PAYMENT = 0.1 * 10**18;
  address public oracle;  // "0x97A6d407f4CD30936679d0a28A3bc2A7F13a2185"
  string  public jobId;   // "32abe898ea834e328ebeb714c5a0991d"
  uint256 public currentValue;
  uint256 public latestTimestamp;
  string public fsyms; // from symbol eg- BTC
  string public tsyms; // to symbol eg- USDT


  //struct to keep track of PLI Deposits
  struct PLIDatabase{
    address depositor;
    uint256 totalcredits;
  }

  mapping(address => PLIDatabase) public plidbs;

  //Initialize event RequestFulfilled   
  event RequestFulfilled(bytes32 indexed requestId,uint256 indexed currentVal,uint256 timestamp);
  //Initialize event requestCreated   
  event requestCreated(address indexed requester,bytes32 indexed jobId, bytes32 indexed requestId,uint256 timestamp);
  event requestCreatedTest(bytes32 indexed jobId, bytes32 indexed requestId,uint256 timestamp);
  event oracleFeeModified(address indexed owner,uint256 indexed oraclefee,uint256 timestamp);
  event pliDeposited(address indexed owner,uint256 indexed amount,uint256 timestamp);
  event withdrawnPli(address indexed owner,uint256 indexed amount,uint256 timestamp);
  event canceledPluginRequest(address indexed owner,bytes32 indexed requestID,uint256 indexed payment,uint256 expiration,uint256 timestamp);

  //Constructor to pass Pli Token Address during deployment
  constructor(address _pli,address _oracle,string memory _jobid,string memory _fsyms, string memory _tsyms) public Ownable() {
    setPluginToken(_pli);
    oracle = address(_oracle);
    jobId = _jobid;
    fsyms = _fsyms;
    tsyms = _tsyms;
  }

  function depositPLI(uint256 _value) public returns(bool) {
      require(_value<=100*10**18,"NOT_MORE_THAN_100_ALLOWED");
      //Transfer PLI to contract
      PliTokenInterface pli = PliTokenInterface(pluginTokenAddress());
      pli.transferFrom(msg.sender,address(this),_value);
      //Track the PLI deposited for the user
      PLIDatabase memory _plidb = plidbs[msg.sender];
      uint256 _totalCredits = _plidb.totalcredits.add(_value);
      plidbs[msg.sender] = PLIDatabase(
        msg.sender,
        _totalCredits
      );
      emit pliDeposited(msg.sender,_value,block.timestamp);
      return true;
  }

  function showPrice() public view returns(uint256){
    return currentValue;
  }

  //set Oracle fee in wei
  function setOracleFee(uint256 _fee) public onlyOwner {
      require(_fee > 0,"invalid fee");
      require(_fee != ORACLE_PAYMENT,"input fee is same as existing fee");
      ORACLE_PAYMENT = _fee;
      emit oracleFeeModified(msg.sender,ORACLE_PAYMENT,block.timestamp);
  }  

  function getOracleFee(address _callee) internal view returns(uint256){  
    uint256 oracleFee;
    if((REGISTRARADDRESS==_callee)){
      oracleFee = REGISTRARFEE;
    }else{
      oracleFee = ORACLE_PAYMENT;
    }
    return oracleFee;
  }

  //_fsyms should be the name of your source token from which you want the comparison 
  //_tsyms should be the name of your destinaiton token to which you need the comparison
  //_jobID should be tagged in Oracle
  //_oracle should be fulfiled with your plugin node address

  function requestData(address _caller)
    public
    returns (bytes32 requestId)
  {
    uint256 _fee = getOracleFee(_caller);
    //Check the total Credits available for the user to perform the transaction
    uint256 _a_totalCredits = plidbs[_caller].totalcredits;
    require(_a_totalCredits>_fee,"NO_SUFFICIENT_CREDITS");
    plidbs[_caller].totalcredits = _a_totalCredits.sub(_fee);
    
    //Built a oracle request with the following params
    Plugin.Request memory req = buildPluginRequest(stringToBytes32(jobId), this, this.fulfill.selector);
    req.add("_fsyms",fsyms);
    req.add("_tsyms",tsyms);
    req.addInt("times", 10000);
    requestId = sendPluginRequestTo(oracle, req, _fee);
    latestTimestamp = block.timestamp;
    emit requestCreated(_caller, stringToBytes32(jobId), requestId,latestTimestamp);
  }

 function testMyFunc()
    public
    onlyOwner
    returns (bytes32 requestId)
  {    
    uint256 _fee = 0.001 * 10**18;
    //Built a oracle request with the following params
    Plugin.Request memory req = buildPluginRequest(stringToBytes32(jobId), this, this.fulfill.selector);
    req.add("_fsyms",fsyms);
    req.add("_tsyms",tsyms);
    req.addInt("times", 10000);

    latestTimestamp = block.timestamp;
    requestId = sendPluginRequestTo(oracle, req, _fee);
    emit requestCreatedTest(stringToBytes32(jobId), requestId,latestTimestamp);
  }


  //callBack function
  function fulfill(bytes32 _requestId, uint256 _currentval)
    public
    recordPluginFulfillment(_requestId)
  {
    // if that speed < 65kmph
    // do write logic for token transfer
    emit RequestFulfilled(_requestId, _currentval,block.timestamp);
    currentValue = _currentval;
  }

  function getPluginToken() public view returns (address) {
    return pluginTokenAddress();
  }

  //With draw pli can be invoked only by owner
  function withdrawPli() public onlyOwner {
    PliTokenInterface pli = PliTokenInterface(pluginTokenAddress());
    uint256 pliBalance =  pli.balanceOf(address(this));
    require(pli.transfer(msg.sender,pliBalance), "Unable to transfer");
    emit withdrawnPli(msg.sender, pliBalance,block.timestamp);
  }

  //Cancel the existing request
  function cancelRequest(
    bytes32 _requestId,
    uint256 _payment,
    bytes4 _callbackFunctionId,
    uint256 _expiration
  )
    public
    onlyOwner
  {
    cancelPluginRequest(_requestId, _payment, _callbackFunctionId, _expiration);
    emit canceledPluginRequest(msg.sender,_requestId,_payment,_expiration,block.timestamp);
  }

  //String to bytes to convert jobid to bytest32
  function stringToBytes32(string memory source) private pure returns (bytes32 result) {
    bytes memory tempEmptyStringTest = bytes(source);
    if (tempEmptyStringTest.length == 0) {
      return 0x0;
    }
    assembly { 
      result := mload(add(source, 32))
    }
  }

}