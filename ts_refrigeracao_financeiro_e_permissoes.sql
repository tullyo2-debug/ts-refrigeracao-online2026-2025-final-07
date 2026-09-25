create or replace function public.fechar_os_integrar_financeiro()
returns trigger language plpgsql set search_path=public as $$
declare total_pago numeric; saldo numeric;
begin
  if new.status='Concluída' and old.status is distinct from new.status then
    if new.data_conclusao is null then new.data_conclusao=now(); end if;
    if new.pagamento_status='Pago' and new.valor_total>0 then
      select coalesce(sum(p.valor),0) into total_pago from public.pagamentos p where p.os_id=new.id;
      saldo:=greatest(new.valor_total-total_pago,0);
      if saldo>0 then insert into public.pagamentos(os_id,valor,forma_pagamento,observacoes,criado_por) values(new.id,saldo,coalesce(new.forma_pagamento,'Não informado'),'Lançamento automático ao fechar a OS',new.criado_por); end if;
    end if;
  end if;
  if new.status='Concluída' and new.pagamento_status='Pago' and old.pagamento_status is distinct from new.pagamento_status and new.valor_total>0 then
    select coalesce(sum(p.valor),0) into total_pago from public.pagamentos p where p.os_id=new.id;
    saldo:=greatest(new.valor_total-total_pago,0);
    if saldo>0 then insert into public.pagamentos(os_id,valor,forma_pagamento,observacoes,criado_por) values(new.id,saldo,coalesce(new.forma_pagamento,'Não informado'),'Lançamento automático após confirmação de pagamento',new.criado_por); end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_fechar_os_integrar_financeiro on public.ordens_servico;
create trigger trg_fechar_os_integrar_financeiro before update on public.ordens_servico for each row execute function public.fechar_os_integrar_financeiro();
create or replace function public.atualizar_data_modificacao() returns trigger language plpgsql set search_path=public as $function$ begin new.atualizado_em=now(); return new; end; $function$;
create or replace function public.total_pago_os(p_os_id uuid) returns numeric language sql stable set search_path=public as $function$ select coalesce(sum(valor),0) from public.pagamentos where os_id=p_os_id; $function$;
