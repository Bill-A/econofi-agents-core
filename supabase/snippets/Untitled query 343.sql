  CREATE OR REPLACE FUNCTION public.set_app_context(bank_id_value text)
  RETURNS void                                                                                                           
  LANGUAGE plpgsql                                                                                                       
  SECURITY DEFINER                                                                                                       
  AS $$                                                                                                                  
  BEGIN                                                                                                                  
    PERFORM set_config('app.current_bank_id', bank_id_value, true);                                                      
  END;                                                                                                                   
  $$; 