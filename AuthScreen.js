import React, { useState } from 'react';

import {
  ActivityIndicator,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

// Cores oficiais da TR Beauty Concept
const C = {
  bg: '#FDFBF7',
  ink: '#2C2C2C',
  mocha: '#7A655B',
  border: '#EBE5DF',
  muted: '#8E8E93'
};

// URL de retorno após autenticação
const redirect = () => {
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined'
  ) {
    return window.location.origin + '/';
  }

  return undefined;
};

export default function AuthScreen({
  recovery = false,
  onRecoveryDone = () => {},
  onBack = null
}) {
  const [mode, setMode] = useState(
    recovery ? 'newPassword' : 'login'
  );

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmationEmail,setConfirmationEmail]=useState('');
  const [confirmationCode,setConfirmationCode]=useState('');
  const [resendBusy,setResendBusy]=useState(false);
  const [resendAfter,setResendAfter]=useState(0);

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState(false);

  // Exibir mensagens
  function notify(value, error = false) {
    setMessage(value);
    setFailure(error);
  }

  // Alternar telas
  function switchMode(next) {
    setMode(next);
    setPassword('');
    setConfirmationCode('');
    notify('');
  }

  // Executar operações com carregamento
  async function run(fn) {
    if (busy) return;

    setBusy(true);
    notify('');

    try {
      await fn();
    } catch (error) {
      notify(
        error?.message ||
          'Ocorreu um erro. Tente novamente.',
        true
      );
    } finally {
      setBusy(false);
    }
  }

  // LOGIN E CADASTRO COM E-MAIL
  const authEmail = () =>
    run(async () => {
      if (!email.trim() || !password) {
        throw new Error(
          'Informe seu e-mail e senha.'
        );
      }

      if (mode === 'signup' && !name.trim()) {
        throw new Error(
          'Informe seu nome completo.'
        );
      }

      if (
        mode === 'signup' &&
        password.length < 8
      ) {
        throw new Error(
          'A senha precisa ter pelo menos 8 caracteres.'
        );
      }

      const normalizedEmail =
        email.trim().toLowerCase();

      if (mode === 'signup') {
        const { data, error } =
          await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: {
              data: {
                full_name: name.trim()
              },
              emailRedirectTo: redirect()
            }
          });

        if (error) throw error;

        if (!data.session) {
          setConfirmationEmail(normalizedEmail);
          setConfirmationCode('');
          setResendAfter(Date.now()+60000);
          setMode('verifyEmail');
          notify('Cadastro recebido! Digite o código enviado para ' + normalizedEmail + '.');
        } else {
          notify('Conta criada com sucesso!');
        }
      } else {
        const { error } =
          await supabase.auth.signInWithPassword({
            email: normalizedEmail,
            password
          });

        if (error) throw error;
      }
    });

  // Confirmar conta pelo código enviado no modelo "Confirm sign up".
  const verifySignupCode = () => run(async () => {
    const target=(confirmationEmail||email).trim().toLowerCase();
    const token=confirmationCode.replace(/\D/g,'');
    if(!target||!/^\d{6,8}$/.test(token))throw new Error('Digite seu e-mail e um código numérico de 6 a 8 dígitos.');
    const {error}=await supabase.auth.verifyOtp({email:target,token,type:'email'});
    if(error)throw new Error('Código inválido ou expirado. Confira o código ou solicite outro.');
    setConfirmationCode('');
    notify('E-mail confirmado com sucesso!');
    // A sessão iniciada pelo Supabase abre o aplicativo automaticamente.
  });
  const resendSignupCode = async () => {
    if(busy||resendBusy)return;
    const target=(confirmationEmail||email).trim().toLowerCase();
    if(!target){notify('Informe o e-mail do cadastro.',true);return;}
    if(Date.now()<resendAfter){notify('Aguarde um minuto antes de reenviar.',true);return;}
    setResendBusy(true);notify('');
    try{
      const {error}=await supabase.auth.resend({type:'signup',email:target});
      if(error)throw error;
      setConfirmationEmail(target);setConfirmationCode('');
      setResendAfter(Date.now()+60000);
      notify('Se a conta estiver aguardando confirmação, enviaremos um novo código para '+target+'.');
    }catch(err){notify('Falha no reenvio: '+(err?.message||'tente novamente.'),true);}
    finally{setResendBusy(false);}
  };

  // RECUPERAÇÃO DE SENHA
  const resetPassword = () =>
    run(async () => {
      if (!email.trim()) {
        throw new Error(
          'Digite seu e-mail para recuperar a senha.'
        );
      }

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          {
            redirectTo: redirect()
          }
        );

      if (error) throw error;

      notify(
        'Se o e-mail estiver cadastrado, ' +
          'você receberá as instruções de recuperação.'
      );
    });

  // DEFINIR NOVA SENHA
  const setNewPassword = () =>
    run(async () => {
      if (password.length < 8) {
        throw new Error(
          'Use uma senha com pelo menos 8 caracteres.'
        );
      }

      const { error } =
        await supabase.auth.updateUser({
          password
        });

      if (error) throw error;

      onRecoveryDone();

      notify('Senha alterada com sucesso!');
    });

  // LOGIN COM GOOGLE
  const loginGoogle = () =>
    run(async () => {
      if (Platform.OS !== 'web') {
        throw new Error(
          'O login com Google está configurado ' +
            'para a versão web.'
        );
      }

      const { error } =
        await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: redirect()
          }
        });

      if (error) throw error;
    });

  // BOTÃO PADRÃO
  const Btn = ({
    title,
    icon,
    onPress,
    outline = false
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      style={[
        s.button,
        outline && s.outline,
        busy && { opacity: 0.65 }
      ]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={19}
          color={outline ? C.ink : '#FFFFFF'}
          style={{ marginRight: 10 }}
        />
      )}

      <Text
        style={[
          s.buttonText,
          outline && { color: C.ink }
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        contentContainerStyle={s.wrap}
        keyboardShouldPersistTaps="handled"
      >
        {/* LOGOTIPO */}
        <View style={s.logo}>
          <Ionicons
            name="sparkles-outline"
            size={30}
            color={C.mocha}
          />
        </View>

        <Text style={s.title}>
          TR Beauty Concept
        </Text>

        {/* SUBTÍTULO */}
        <Text style={s.subtitle}>
          {mode === 'signup'
            ? 'Crie sua conta e agende seus cuidados'
            : mode === 'reset'
            ? 'Recuperar acesso'
            : mode === 'verifyEmail'
            ? 'Confirme sua conta com o código recebido'
            : mode === 'newPassword'
            ? 'Escolha uma nova senha'
            : 'Bem-vinda ao seu espaço de beleza'}
        </Text>

        {/* CAMPOS DE LOGIN, CADASTRO E RECUPERAÇÃO */}
        {(
          mode === 'login' ||
          mode === 'signup' ||
          mode === 'reset'
        ) && (
          <>
            {mode === 'signup' && (
              <>
                <Text style={s.label}>
                  Nome completo
                </Text>

                <TextInput
                  style={s.input}
                  value={name}
                  onChangeText={setName}
                  autoComplete="name"
                  placeholder="Seu nome"
                />
              </>
            )}

            <Text style={s.label}>
              E-mail
            </Text>

            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              autoComplete="email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="seuemail@exemplo.com"
            />

            {mode !== 'reset' && (
              <>
                <Text style={s.label}>
                  Senha
                </Text>

                <TextInput
                  style={s.input}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete={
                    mode === 'signup'
                      ? 'new-password'
                      : 'current-password'
                  }
                  placeholder="Sua senha"
                />
              </>
            )}
          </>
        )}

        {/* CÓDIGO DE VERIFICAÇÃO DO NOVO CADASTRO */}
        {mode === 'verifyEmail' && <>
          <Text style={s.label}>E-mail do cadastro</Text>
          <TextInput style={s.input} value={confirmationEmail}
            onChangeText={v=>setConfirmationEmail(v.trim().toLowerCase())}
            keyboardType="email-address" autoCapitalize="none" autoComplete="email"
            placeholder="seuemail@exemplo.com" editable={!busy&&!resendBusy}/>
          <Text style={s.label}>Código de confirmação</Text>
          <TextInput style={[s.input,s.codeInput]} value={confirmationCode}
            onChangeText={v=>setConfirmationCode(v.replace(/\D/g,'').slice(0,8))}
            keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code"
            placeholder="Digite o código" maxLength={8}
            accessibilityLabel="Código de confirmação do cadastro"/>
          <Text style={s.codeHint}>Digite o código enviado ao e-mail. Não compartilhe esse código com ninguém.</Text>
        </>}

        {/* NOVA SENHA */}
        {mode === 'newPassword' && (
          <>
            <Text style={s.label}>
              Nova senha
            </Text>

            <TextInput
              style={s.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="Mínimo de 8 caracteres"
            />
          </>
        )}

        {/* MENSAGENS */}
        {!!message && (
          <Text
            style={[
              s.message,
              {
                color: failure
                  ? '#B42318'
                  : '#276749'
              }
            ]}
          >
            {message}
          </Text>
        )}

        {busy && (
          <ActivityIndicator
            color={C.mocha}
            style={{ marginBottom: 12 }}
          />
        )}

        {/* TELA DE LOGIN */}
        {mode === 'login' && (
          <>
            <Btn
              title="Entrar"
              onPress={authEmail}
            />

            <Btn title="Criar minha conta" outline onPress={()=>switchMode('signup')}/>
            <TouchableOpacity style={s.link} accessibilityRole="button"
              onPress={()=>{setConfirmationEmail(email.trim().toLowerCase());switchMode('verifyEmail');}}>
              <Text style={s.linkText}>Já tenho um código de confirmação</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() =>
                switchMode('reset')
              }
              style={s.link}
            >
              <Text style={s.linkText}>
                Esqueci minha senha
              </Text>
            </TouchableOpacity>

            <Text style={s.or}>
              ou continue com
            </Text>

            <Btn
              title="Continuar com Google"
              icon="logo-google"
              outline
              onPress={loginGoogle}
            />
          </>
        )}

        {/* TELA DE CADASTRO */}
        {mode === 'signup' && (
          <>
            <Btn
              title="Cadastrar"
              onPress={authEmail}
            />

            <Btn
              title="Já tenho conta"
              outline
              onPress={() =>
                switchMode('login')
              }
            />
          </>
        )}

        {mode === 'verifyEmail' && <>
          <Btn title="Confirmar meu e-mail" icon="shield-checkmark-outline" onPress={verifySignupCode}/>
          <TouchableOpacity style={s.link} accessibilityRole="button" disabled={busy||resendBusy}
            onPress={resendSignupCode}>
            <Text style={s.linkText}>{resendBusy?'Reenviando...':'Não recebi o código — reenviar'}</Text>
          </TouchableOpacity>
          <Btn title="Voltar ao login" outline onPress={()=>switchMode('login')}/>
        </>}

        {/* TELA DE RECUPERAÇÃO */}
        {mode === 'reset' && (
          <>
            <Btn
              title="Enviar recuperação"
              onPress={resetPassword}
            />

            <Btn
              title="Voltar ao login"
              outline
              onPress={() =>
                switchMode('login')
              }
            />
          </>
        )}

        {/* TELA DE NOVA SENHA */}
        {mode === 'newPassword' && (
          <Btn
            title="Salvar nova senha"
            onPress={setNewPassword}
          />
        )}

        {!!onBack && !recovery && (
          <TouchableOpacity onPress={onBack} disabled={busy} style={s.backToSite}
            accessibilityRole="button" accessibilityLabel="Continuar navegando sem conta">
            <Ionicons name="arrow-back-outline" size={19} color={C.mocha}/>
            <Text style={s.backToSiteText}>Continuar navegando sem conta</Text>
          </TouchableOpacity>
        )}

        {/* RODAPÉ */}
        <Text style={s.foot}>
          Seus dados são protegidos pela
          {' '}TR Beauty Concept.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ESTILOS
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg
  },

  wrap: {
    padding: 28,
    flexGrow: 1,
    justifyContent: 'center',
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center'
  },

  logo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 18
  },

  title: {
    textAlign: 'center',
    fontSize: 29,
    fontWeight: '700',
    color: C.ink
  },

  subtitle: {
    textAlign: 'center',
    fontSize: 14,
    color: C.muted,
    marginBottom: 28,
    marginTop: 8
  },

  label: {
    fontWeight: '600',
    color: C.ink,
    marginBottom: 8
  },

  input: {
    padding: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    marginBottom: 16,
    fontSize: 16
  },

  button: {
    backgroundColor: C.ink,
    paddingVertical: 15,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10
  },

  outline: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: C.border
  },

  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15
  },

  link: {
    alignSelf: 'center',
    padding: 10
  },

  linkText: {
    color: C.mocha,
    fontWeight: '600'
  },

  or: {
    textAlign: 'center',
    color: C.muted,
    marginVertical: 15
  },

  message: {
    marginBottom: 16,
    textAlign: 'center'
  },

  backToSite: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', paddingVertical: 15, marginTop: 14 },
  backToSiteText: { fontSize: 13, fontWeight: '700', color: C.mocha },
  codeInput:{textAlign:'center',fontSize:24,letterSpacing:5,fontWeight:'700'},
  codeHint:{fontSize:12,lineHeight:19,color:C.muted,marginBottom:18,textAlign:'center'},
  foot: {
    textAlign: 'center',
    color: C.muted,
    fontSize: 11,
    marginTop: 18
  }
});
