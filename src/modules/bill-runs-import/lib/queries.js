'use strict';

exports.importNaldBillRuns = `
insert into water.billing_batches (
  region_id, batch_type, date_created, date_updated, from_financial_year_ending,
  to_financial_year_ending, status, invoice_count, credit_note_count,
  net_total, bill_run_number, is_summer, source, legacy_id, metadata
)
select r.region_id,
(case 
when nbr."BILL_RUN_TYPE"='A' then 'annual'
when nbr."BILL_RUN_TYPE"='S' then 'supplementary'
when nbr."BILL_RUN_TYPE"='R' then 'two_part_tariff'
end)::water.charge_batch_type as batch_type,
to_date(nbr."INITIATION_DATE", 'DD/MM/YYYY') as date_created,
to_date(nbr."BILL_RUN_STATUS_DATE", 'DD/MM/YYYY') as date_updated,
nbr."FIN_YEAR"::integer as from_financial_year_ending,
nbr."FIN_YEAR"::integer as to_financial_year_ending,
'sent' as status,
nullif(nbr."NO_OF_INVS", 'null')::integer as invoice_count,
nullif(nbr."NO_OF_CRNS", 'null')::integer as credit_note_count,
(
(nullif(nbr."VALUE_OF_INVS", 'null')::numeric * 100) + 
(nullif(nbr."VALUE_OF_CRNS", 'null')::numeric * 100) 
)::bigint as net_total,
nbr."BILL_RUN_NO"::integer as bill_run_number,
false as is_summer,
'nald'::water.billing_batch_source as source,
concat_ws(':', nbr."FGAC_REGION_CODE", nbr."BILL_RUN_NO") as legacy_id,
row_to_json(nbr) as metadata
from import."NALD_BILL_RUNS" nbr
join water.regions r on nbr."FGAC_REGION_CODE"::integer=r.nald_region_id
where 
nbr."BILL_RUN_TYPE" in ('A', 'S', 'R')
and nbr."IAS_XFER_DATE"<>'null'
and nbr."FIN_YEAR"::integer>=2015
on conflict (legacy_id) do nothing;
`;

exports.importNaldBillHeaders = `
insert into water.billing_invoices (
  invoice_account_id, address, invoice_account_number, net_amount,
  is_credit, date_created, date_updated, billing_batch_id, financial_year_ending,
  legacy_id, metadata, invoice_number
)
select 
ia.invoice_account_id,
'{}'::jsonb as address,
nbh."IAS_CUST_REF" as invoice_account_number,
nbh."NET_AMOUNT"::numeric*100 as net_amount,
nbh."BILL_TYPE"='C' as is_credit,
b.date_created,
b.date_updated,
b.billing_batch_id,
nbh."FIN_YEAR"::integer as financial_year_ending,
concat_ws(':', nbh."FGAC_REGION_CODE", nbh."ID") as legacy_id,
row_to_json(nbh) as metadata,
nullif(nbh."BILL_NO", 'null') as invoice_number
from import."NALD_BILL_HEADERS" nbh
left join crm_v2.invoice_accounts ia on nbh."IAS_CUST_REF"=ia.invoice_account_number
join water.billing_batches b on b.legacy_id=concat_ws(':', nbh."FGAC_REGION_CODE", nbh."ABRN_BILL_RUN_NO")
on conflict (legacy_id) do nothing;
`;

exports.importInvoiceLicences = `
insert into water.billing_invoice_licences (
  billing_invoice_id, licence_ref, date_created, date_updated, licence_id
)
select 
i.billing_invoice_id, 
nl."LIC_NO" as licence_ref, 
i.date_created, 
i.date_updated, 
l.licence_id
from import."NALD_BILL_HEADERS" nbh
join water.billing_invoices i on concat_ws(':', nbh."FGAC_REGION_CODE", nbh."ID")=i.legacy_id
left join import."NALD_BILL_TRANS" nbt on nbh."FGAC_REGION_CODE"=nbt."FGAC_REGION_CODE" and nbh."ID"=nbt."ABHD_ID" 
join import."NALD_ABS_LICENCES" nl on nbt."FGAC_REGION_CODE"=nl."FGAC_REGION_CODE" and nbt."LIC_ID"=nl."ID"
left join water.licences l on nl."LIC_NO"=l.licence_ref
on conflict (billing_invoice_id, licence_id) do nothing;
`;

exports.importTransactions = `
insert into water.billing_transactions ( 
  billing_invoice_licence_id, 
  charge_element_id, 
  start_date, 
  end_date,
  abstraction_period,
  source,
  season,
  loss,
  is_credit,
  authorised_quantity,
  billable_quantity,
  authorised_days,
  billable_days,
  status,
  date_created,
  date_updated,
  volume,
  section_126_factor,
  section_127_agreement,
  section_130_agreement,
  is_two_part_tariff_supplementary,
  is_de_minimis,
  is_new_licence,
  charge_type,
  net_amount,
  legacy_id,
  description,
  metadata
)
select 
il.billing_invoice_licence_id,
ce.charge_element_id,
to_date(nbt."BILL_ST_DATE", 'DD/MM/YYYY') as start_date,
to_date(nbt."BILL_END_DATE", 'DD/MM/YYYY') as end_date,
json_build_object(
  'startDay', ce.abstraction_period_start_day,
  'startMonth', ce.abstraction_period_start_month,
  'endDay', ce.abstraction_period_end_day,
  'endMonth', ce.abstraction_period_end_month
) as abstraction_period,
ce.source,
ce.season,
ce.loss,
nbt."TRANS_TYPE"='C' as is_credit,
ce.authorised_annual_quantity as authorised_quantity,
ce.billable_annual_quantity as billable_quantity,
nbt."ABS_PER_DAYS"::integer as authorised_days,
nbt."BILLABLE_DAYS"::integer as billable_days,
'charge_created' as status,
i.date_created,
i.date_updated,
nbt."BILLABLE_ANN_QTY"::numeric as volume,
null as section_126_factor,
nbt."ELEMENT_AGRMNTS"='S127' as section_127_agreement,
case 
  when left(nbt."LH_ACC_AGRMNTS", 4)='S130' then nbt."LH_ACC_AGRMNTS"
  else null
end as section_130_agreement,
nbr."BILL_RUN_TYPE"='R' as is_two_part_tariff_supplementary,
false as is_de_minimis,
nbt."NEW_OWN_FLAG"<>'null' as is_new_licence,
nbt2.charge_type,
nbt2.net_amount,
nbt2.legacy_id,
nbt2.description,
row_to_json(nbt) as metadata
from import."NALD_BILL_TRANS" nbt
join import."NALD_BILL_RUNS" nbr on nbt."FGAC_REGION_CODE"=nbr."FGAC_REGION_CODE" and nbt."ABRN_BILL_RUN_NO"=nbr."BILL_RUN_NO"
join water.billing_invoices i on concat_ws(':', nbt."FGAC_REGION_CODE", nbt."ABHD_ID")=i.legacy_id
join (
  -- Get billing invoice licences with NALD licence ID
  select il.billing_invoice_licence_id, il.billing_invoice_id, nl."ID"
  from water.billing_invoice_licences il 
  join import."NALD_ABS_LICENCES" nl on il.licence_ref=nl."LIC_NO"
) il on i.billing_invoice_id=il.billing_invoice_id and nbt."LIC_ID"=il."ID"
left join water.charge_elements ce on concat_ws(':', nbt."FGAC_REGION_CODE", nbt."ACEL_ID")=ce.external_id
left join(
  -- Gets standard charges
  select 
  nbt."ID", 
  nbt."FGAC_REGION_CODE", 
  'standard'::water.charge_type as charge_type,
  nbt."FINAL_A1_BILLABLE_AMOUNT"::numeric*100 as net_amount,
  concat_ws(':', nbt."FGAC_REGION_CODE", nbt."ID", 'S') as legacy_id,
  concat(
    -- Two-part tariff charge prefix
    case 
      when nbt2.is_two_part_tariff and nbt2.is_two_part_tariff_supplementary 
        then concat('Second part ', nbt2.purpose_use_descr, ' charge')
      when nbt2.is_two_part_tariff and not nbt2.is_two_part_tariff_supplementary 
        then concat('First part ', nbt2.purpose_use_descr, ' charge')
      end,
    -- At {charge element description} suffix for all 2PT charges
    case
      when nbt2.is_two_part_tariff=true and nbt2.charge_element_descr is not null
        then concat(' at ', nbt2.charge_element_descr)
      end,
    -- Non 2PT - charge element description defaulting to purpose use description
    case 
      when not nbt2.is_two_part_tariff
        then coalesce(nbt2.charge_element_descr, nbt2.purpose_use_descr)
      end
  ) as description
  from import."NALD_BILL_TRANS" nbt
  join (
    select 
    nbt."FGAC_REGION_CODE",
    nbt."ID",
    nbr."BILL_RUN_TYPE"='R' as is_two_part_tariff_supplementary,
    nbt."ELEMENT_AGRMNTS"='S127' as is_two_part_tariff,
    nullif(nullif(nce."DESCR", 'null'), '') as charge_element_descr,
    npu."DESCR" as purpose_use_descr
    from import."NALD_BILL_TRANS" nbt
    join import."NALD_BILL_RUNS" nbr on nbt."FGAC_REGION_CODE"=nbr."FGAC_REGION_CODE" and nbt."ABRN_BILL_RUN_NO"=nbr."BILL_RUN_NO"
    join import."NALD_CHG_ELEMENTS" nce on nbt."ACEL_ID"=nce."ID" and nbt."FGAC_REGION_CODE"=nce."FGAC_REGION_CODE"
    join import."NALD_PURP_USES" npu on nce."APUR_APUS_CODE"=npu."CODE"
  ) nbt2 on nbt."FGAC_REGION_CODE"=nbt2."FGAC_REGION_CODE" and nbt."ID"=nbt2."ID"
  -- Gets compensation charges
  union select  
  nbt."ID", 
  nbt."FGAC_REGION_CODE", 
  'compensation'::water.charge_type as charge_type,
  nbt."FINAL_A2_BILLABLE_AMOUNT"::numeric*100 as net_amount,
  concat_ws(':', nbt."FGAC_REGION_CODE", nbt."ID", 'C') as legacy_id,
  'Compensation Charge calculated from all factors except Standard Unit Charge and Source (replaced by factors below) and excluding S127 Charge Element' as description
  from import."NALD_BILL_TRANS" nbt
  join (
    -- Non-TPT bill runs
    select nbr."FGAC_REGION_CODE", nbr."BILL_RUN_NO" 
    from import."NALD_BILL_RUNS" nbr 
    where nbr."BILL_RUN_TYPE" in ('A', 'S')
  ) nbr on nbt."FGAC_REGION_CODE"=nbr."FGAC_REGION_CODE" and nbt."ABRN_BILL_RUN_NO"=nbr."BILL_RUN_NO"
  left join (
    -- Get flag for water undertaker licences
    select nl."FGAC_REGION_CODE", nl."ID", right(nl."AREP_EIUC_CODE", 3)='SWC' as is_water_undertaker
    from import."NALD_ABS_LICENCES" nl 
  ) nl on nbt."FGAC_REGION_CODE"=nl."FGAC_REGION_CODE" and nbt."LIC_ID"=nl."ID"
  where not (nbt."FINAL_A2_BILLABLE_AMOUNT"::numeric=0 and nl.is_water_undertaker=true)
) nbt2 on nbt2."FGAC_REGION_CODE"=nbt."FGAC_REGION_CODE" and nbt2."ID"=nbt."ID"
on conflict (legacy_id) do nothing;
`;

exports.setTransactionKeys = `
update water.billing_transactions t1
set transaction_key=t2.transaction_key
from (
  select
    t.billing_transaction_id,
    MD5(
    array_to_string(ARRAY[
    'accountNumber:' || i.invoice_account_number, 
    'agreements:' || t.agreements,
    'authorisedDays:' || t.authorised_days,
    'billableDays:' || t.billable_days,
    'description:' || t.description,
    'isCompensationCharge:' || (case when t.charge_type='compensation' then 'true' else 'false' end),
    'isNewLicence:' || (case when t.is_new_licence then 'true' else 'false' end),
    'isTwoPartTariff:' || (case when t.is_two_part_tariff_supplementary then 'true' else 'false' end),
    'licenceNumber:' || il.licence_ref,
    'loss:' || t.loss,
    'periodEnd:' || t.end_date,
    'periodStart:' || t.start_date,
    'regionCode:' || r.charge_region_id,
    'season:' || t.season,
    'source:' || t.source,
    'volume:' || t.volume
    ], ','))
    as transaction_key
  from water.billing_batches b
  join water.regions r on b.region_id=r.region_id
  left join water.billing_invoices i on b.billing_batch_id=i.billing_batch_id
  left join water.billing_invoice_licences il on i.billing_invoice_id=il.billing_invoice_id
  left join (
    select *, 
      case 
        when t.section_130_agreement is not null then t.section_130_agreement
        when t.section_127_agreement=true then 'S127'
        else ''
      end as agreements
     from water.billing_transactions t
  ) t on il.billing_invoice_licence_id=t.billing_invoice_licence_id
  where b.source='nald'

) t2 where t1.billing_transaction_id=t2.billing_transaction_id;
`;

exports.importBillingVolumes = `
insert into water.billing_volumes (
  charge_element_id, financial_year, is_summer,
  calculated_volume, two_part_tariff_error, two_part_tariff_status,
  two_part_tariff_review, is_approved, billing_batch_id,
  volume, errored_on
)
select 
t.charge_element_id, 
i.financial_year_ending as financial_year,
false as is_summer,
null as calculated_volume,
false as two_part_tariff_error,
null as two_part_tariff_status,
null as two_part_tariff_review,
true as is_approved,
b.billing_batch_id,
t.volume,
null as errored_on
from water.billing_batches b 
join water.billing_invoices i on b.billing_batch_id=i.billing_batch_id
join water.billing_invoice_licences il on il.billing_invoice_id=i.billing_invoice_id
join water.billing_transactions t on il.billing_invoice_licence_id=t.billing_invoice_licence_id 
where b.source='nald' and b.batch_type='two_part_tariff'
on conflict do nothing;
`;
