import React, {useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {supabase} from './supabase';

const C={ink:'#30231E',mocha:'#7A655B',muted:'#756B65',
  border:'#E8DED4',soft:'#F5EFE8',white:'#FFFFFF',red:'#A84B4D'};

/**
 * Consulta apenas CONTAGENS dos vínculos principais de um pedido de exclusão.
 * Nenhum dado pessoal nem lançamento financeiro é modificado por esta tela.
 * O resultado NÃO substitui verificação jurídica/operacional de retenção.
 */
export default function AdminDeletionImpact({userId}) {
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try {
      if(!userId)throw new Error('Cliente não identificado');
      const results=await Promise.all([
        supabase.from('appointments').select('id',{count:'exact',head:true})
          .eq('client_id',userId).in('status',['pending','confirmed']),
        supabase.from('appointments').select('id',{count:'exact',head:true})
          .eq('client_id',userId).eq('status','completed'),
        supabase.from('points_ledger').select('id',{count:'exact',head:true})
          .eq('client_id',userId),
        supabase.from('appointment_payments')
          .select('id,appointments!inner(client_id)',{count:'exact',head:true})
          .eq('appointments.client_id',userId),
      ]);
      for(const result of results) {
        if(result.error)throw result.error;
        if(!Number.isInteger(result.count)||result.count<0)
          throw new Error('Contagem de vínculos indisponível; verificação incompleta');
      }
      setData({
        active:results[0].count,
        completed:results[1].count,
        points:results[2].count,
        payments:results[3].count,
      });
    }catch(e){
      setData(null);
      setError('Não foi possível concluir a verificação: '+(e?.message||'erro desconhecido'));
    }finally{setLoading(false);}
  },[userId,refresh]);

  useEffect(()=>{load();},[load]);

  return <View style={s.wrap}>
    <View style={s.heading}>
      <Text style={s.title}>Verificação de vínculos da conta</Text>
      <TouchableOpacity onPress={()=>setRefresh(v=>v+1)}
        accessibilityRole="button" accessibilityLabel="Reverificar vínculos da conta"
        disabled={loading} style={s.refresh}>
        <Ionicons name="refresh-outline" size={18} color={C.mocha}/>
      </TouchableOpacity>
    </View>
    <Text style={s.note}>
      Consulta administrativa somente de leitura. Os números são uma avaliação
      preliminar, não uma autorização para excluir a conta.
    </Text>
    {loading&&<View style={s.loading}>
      <ActivityIndicator color={C.mocha}/>
      <Text style={s.note}>Verificando vínculos existentes...</Text>
    </View>}
    {!!error&&<Text style={s.error}>{error}</Text>}
    {!loading&&!error&&data&&<>
      <View style={s.grid}>
        {[
          ['Agendamentos ativos',data.active],
          ['Atendimentos concluídos',data.completed],
          ['Movimentações TR Points',data.points],
          ['Registros financeiros',data.payments],
        ].map(([label,count])=><View key={label} style={s.item}>
          <Text style={s.value}>{count}</Text>
          <Text style={s.itemLabel}>{label}</Text>
        </View>)}
      </View>
      {data.active>0&&<Text style={s.warning}>
        Existem agendamentos pendentes ou confirmados. É necessário tratar essas
        reservas antes de qualquer solicitação de exclusão efetiva.
      </Text>}
      {data.payments>0&&<Text style={s.warning}>
        Existem lançamentos financeiros vinculados aos atendimentos, inclusive
        eventuais registros anulados. Avalie a retenção legal e a trilha de auditoria.
      </Text>}
      <Text style={s.note}>
        Ainda podem existir fotos, notificações, registros fiscais ou informações
        em provedores externos. Confirme a identidade da titular e as obrigações de
        retenção antes de encaminhar o pedido ao procedimento seguro de exclusão.
      </Text>
    </>}
  </View>;
}

const s=StyleSheet.create({
  wrap:{marginTop:15,padding:14,backgroundColor:C.soft,borderRadius:12,
    borderWidth:1,borderColor:C.border},
  heading:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},
  title:{fontSize:14,fontWeight:'700',color:C.ink,flex:1},
  refresh:{padding:8},
  note:{fontSize:11,lineHeight:18,color:C.muted,marginTop:9},
  error:{fontSize:12,lineHeight:19,color:C.red,marginTop:12},
  loading:{alignItems:'center',gap:8,paddingVertical:15},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:8,marginTop:13},
  item:{minWidth:105,flexBasis:'45%',flexGrow:1,padding:11,borderRadius:10,
    backgroundColor:C.white,borderWidth:1,borderColor:C.border},
  value:{fontSize:19,fontWeight:'700',color:C.ink},
  itemLabel:{fontSize:11,color:C.muted,marginTop:4,lineHeight:16},
  warning:{fontSize:11,lineHeight:18,color:C.red,marginTop:10},
});
