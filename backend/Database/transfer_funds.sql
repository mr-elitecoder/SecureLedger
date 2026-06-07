set @p_result = '0';
call secureledger.transfer_funds(5, 7, 500, 'Get Coffe', '::100', @p_result);
select @p_result;
