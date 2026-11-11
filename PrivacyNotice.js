import React from 'react';
import {Linking,Modal,ScrollView,StyleSheet,Text,TouchableOpacity,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';

const C={ink:'#30231E',brown:'#402816',mocha:'#7A655B',
  soft:'#F9F5F0',border:'#E8DED4',white:'#FFFFFF'};
function Section({title,children}){
  return <View style={s.section}>
    <Text style={s.heading}>{title}</Text>
    <Text style={s.body}>{children}</Text>
  </View>;
}
export default function PrivacyNotice({visible=false,onClose=()=>{}}){
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={s.overlay}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar aviso"
        style={StyleSheet.absoluteFillObject} onPress={onClose}/>
      <View style={s.dialog} accessibilityViewIsModal>
        <View style={s.header}>
          <Ionicons name="shield-checkmark-outline" color={C.mocha} size={23}/>
          <Text style={s.title}>Aviso de Privacidade</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fechar"
            onPress={onClose} style={s.close}>
            <Ionicons name="close" size={22} color={C.mocha}/>
          </TouchableOpacity>
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.content}>
          <Text style={s.update}>TR BEAUTY CONCEPT · Atualizado em 11/11/2026</Text>
          <Text style={s.intro}>
            Este aviso explica, de forma resumida, como os dados informados no
            TR Beauty Concept são usados para operar o site e os atendimentos.
            Dúvidas ou solicitações podem ser encaminhadas ao WhatsApp do estúdio.
          </Text>
          <Section title="1. Dados utilizados">
            Nome, e-mail, telefone/WhatsApp, informações da conta, serviços
            contratados e agendamentos, preferências de atendimento, histórico
            e TR Points. Aniversário e fotos são opcionais, conforme a função usada.
            Também podem existir registros técnicos necessários para autenticação,
            prevenção de fraudes e funcionamento do sistema.
          </Section>
          <Section title="2. Finalidades">
            Criar e proteger a conta, gerenciar reservas, prestar os serviços
            solicitados, atender mensagens, operar o programa de fidelidade,
            prevenir acessos indevidos e manter registros exigidos por lei.
            Comunicações e ofertas dependem das preferências e dos canais habilitados.
          </Section>
          <Section title="3. Compartilhamento e fornecedores">
            O aplicativo utiliza Supabase para autenticação, banco de dados e
            arquivos, e Vercel para hospedagem do site. Quando os respectivos
            canais estiverem ativos e autorizados, e-mails poderão utilizar Resend
            e mensagens poderão utilizar WhatsApp/Meta. Essas operações podem
            envolver infraestrutura e tratamento de dados fora do Brasil.
          </Section>
          <Section title="4. Fotografias e portfólio">
            Fotos publicadas no portfólio são visíveis ao público. No sistema
            atual, imagens de perfil também podem ter URLs públicas acessíveis
            por quem possuir o link. Evite enviar imagens ou documentos sensíveis.
          </Section>
          <Section title="5. Preferências e consentimentos">
            Você pode revisar as preferências de WhatsApp, e-mail, avisos no
            aplicativo e novidades na aba Perfil. Os consentimentos podem ser
            retirados para comunicações futuras. O registro de preferência por
            promoções não significa que exista uma campanha ativa.
          </Section>
          <Section title="6. Segurança e conservação">
            O sistema usa autenticação, regras de acesso por conta e controles
            de segurança. Os dados são mantidos pelo período necessário às
            finalidades informadas e, quando aplicável, ao cumprimento de
            obrigações legais ou defesa de direitos. O prazo depende do tipo
            de registro e de sua finalidade.
          </Section>
          <Section title="7. Seus direitos">
            Você pode solicitar informações, acesso, correção, revisão das
            preferências e exclusão de dados, observadas as hipóteses de
            conservação previstas na LGPD. A solicitação de exclusão é
            registrada no aplicativo e analisada pelo estúdio; ela não apaga
            automaticamente a conta ou o histórico de reservas.
          </Section>
          <Section title="8. Contato">
            TR Beauty Concept — Rua Santa Cruz, 537, Diadema/SP.
            WhatsApp do estúdio: (11) 94690-1167.
          </Section>
          <Text style={s.note}>
            Este aviso descreve os recursos técnicos identificados no site.
            A administração deve revisar periodicamente as práticas de
            retenção, fornecedores e obrigações legais antes de mudanças
            relevantes no tratamento de dados.
          </Text>
          <TouchableOpacity accessibilityRole="button" style={s.contact}
            onPress={()=>Linking.openURL('https://wa.me/5511946901167?text='+
              encodeURIComponent('Olá! Gostaria de esclarecer uma dúvida sobre o tratamento dos meus dados no TR Beauty Concept.'))}>
            <Ionicons name="logo-whatsapp" color={C.white} size={19}/>
            <Text style={s.contactLabel}>Falar com o estúdio</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const s=StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(23,17,13,.62)',alignItems:'center',
    justifyContent:'center',padding:14},
  dialog:{backgroundColor:C.white,borderRadius:19,width:'100%',maxWidth:640,
    maxHeight:'88%',overflow:'hidden'},
  header:{flexDirection:'row',alignItems:'center',padding:18,gap:11,
    borderBottomWidth:1,borderBottomColor:C.border},
  title:{flex:1,fontSize:19,fontWeight:'800',color:C.ink},
  close:{padding:5},
  scroll:{minHeight:0},
  content:{padding:20,paddingBottom:28},
  update:{fontSize:11,fontWeight:'700',letterSpacing:.4,color:C.mocha,marginBottom:14},
  intro:{fontSize:13,lineHeight:21,color:C.ink,marginBottom:10},
  section:{marginTop:13},
  heading:{fontSize:14,fontWeight:'800',color:C.ink,marginBottom:6},
  body:{color:C.mocha,fontSize:12,lineHeight:20},
  note:{fontSize:11,lineHeight:19,color:C.mocha,marginTop:18,
    padding:13,backgroundColor:C.soft,borderRadius:11},
  contact:{flexDirection:'row',gap:10,alignItems:'center',justifyContent:'center',
    padding:15,backgroundColor:C.brown,borderRadius:12,marginTop:18},
  contactLabel:{fontSize:14,fontWeight:'700',color:C.white},
});
