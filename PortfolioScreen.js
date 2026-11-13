import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabase';

const C = {
  bg: '#FDFBF7', white: '#FFFFFF', ink: '#2C2C2C', muted: '#756B65',
  mocha: '#7A655B', border: '#E6DDD5', soft: '#F2ECE6',
  error: '#A52936', success: '#276749',
};
const BUCKET = 'portfolio';
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const inputType = 'image/jpeg,image/png,image/webp';
const getUrl = (path) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
const fileExt = (type) => type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
const blank = () => ({ title: '', caption: '', service_id: '' });

export default function PortfolioScreen({ adminMode = false, services = [] }) {
  const { width } = useWindowDimensions();
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [form, setForm] = useState(blank());
  const [chosenFile, setChosenFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: queryError } = await supabase
      .from('portfolio_photos')
      .select('id,title,caption,image_path,service_id,sort_order,created_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(250);
    if (queryError) setError('Não conseguimos carregar a galeria. Tente novamente.');
    else setPhotos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const serviceOptions = useMemo(() => (services || [])
    .filter(s => s && s.id && s.name)
    .map(s => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [services]);

  const availableFilters = useMemo(() => {
    const used = new Set(photos.map(p => p.service_id).filter(Boolean));
    const items = [{ id: 'all', label: 'Todos' }];
    for (const s of serviceOptions) {
      if (used.has(s.id)) items.push({ id: s.id, label: s.name });
    }
    if (photos.some(p => !p.service_id || !serviceOptions.some(s => s.id === p.service_id))) {
      items.push({ id: 'other', label: 'Outros' });
    }
    return items;
  }, [photos, serviceOptions]);

  const visiblePhotos = useMemo(() => photos.filter(p =>
    filter === 'all' || (filter === 'other'
      ? !p.service_id || !serviceOptions.some(s => s.id === p.service_id)
      : p.service_id === filter)
  ), [photos, filter, serviceOptions]);

  const serviceName = (id) => serviceOptions.find(s => s.id === id)?.name || 'Outros';
  const wide = width >= 740;

  const resetForm = () => {
    setEditing(null);
    setForm(blank());
    setChosenFile(null);
    setFileInputKey(k => k + 1);
    setFormVisible(false);
  };

  const newPhoto = () => {
    resetForm();
    setFormVisible(true);
    setConfirmDeleteId(null);
    setError('');
    setNotice('');
  };

  const startEdit = (photo) => {
    setEditing(photo);
    setForm({
      title: photo.title || '',
      caption: photo.caption || '',
      service_id: photo.service_id || '',
    });
    setChosenFile(null);
    setFileInputKey(k => k + 1);
    setFormVisible(true);
    setConfirmDeleteId(null);
    setError('');
    setNotice('');
  };

  const selectFile = (event) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    if (!TYPES.includes(file.type)) {
      setError('Escolha uma imagem JPG, PNG ou WEBP.');
      setChosenFile(null);
      return;
    }
    if (file.size > MAX_FILE_BYTES || file.size <= 0) {
      setError('Cada foto deve ter entre 1 byte e 5 MB.');
      setChosenFile(null);
      return;
    }
    setError('');
    setChosenFile(file);
  };

  async function save() {
    if (!adminMode || busy) return;
    const title = form.title.trim();
    const caption = form.caption.trim();
    if (!title || title.length > 100 || caption.length > 500) {
      setError('Informe um título de até 100 caracteres e uma descrição de até 500.');
      return;
    }
    if (!editing && !chosenFile) {
      setError('Selecione uma imagem antes de publicar.');
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    let uploadedPath = null;
    let saved = false;
    try {
      const payload = {
        title,
        caption: caption || null,
        service_id: form.service_id || null,
      };
      if (chosenFile) {
        if (!TYPES.includes(chosenFile.type) || chosenFile.size > MAX_FILE_BYTES) {
          throw new Error('A imagem selecionada não é válida.');
        }
        const path = 'works/' + Date.now() + '-' + Math.random().toString(36).slice(2, 14) +
          '.' + fileExt(chosenFile.type);
        const { error: uploadError } = await supabase.storage.from(BUCKET)
          .upload(path, chosenFile, {
            contentType: chosenFile.type,
            upsert: false,
            cacheControl: '3600',
          });
        if (uploadError) throw uploadError;
        uploadedPath = path;
        payload.image_path = path;
      }

      if (editing) {
        const { data, error: dbError } = await supabase.from('portfolio_photos')
          .update(payload).eq('id', editing.id).select('id').maybeSingle();
        if (dbError) throw dbError;
        if (!data) throw new Error('Esta foto foi modificada. Atualize a galeria e tente novamente.');
      } else {
        const nextOrder = photos.reduce((max, p) => Math.max(max, Number(p.sort_order) || 0), -1) + 1;
        const { error: dbError } = await supabase.from('portfolio_photos')
          .insert({ ...payload, sort_order: nextOrder });
        if (dbError) throw dbError;
      }
      saved = true;

      let oldFileCleanupError = false;
      if (uploadedPath && editing && editing.image_path !== uploadedPath) {
        const { error: oldFileError } = await supabase.storage.from(BUCKET)
          .remove([editing.image_path]);
        oldFileCleanupError = !!oldFileError;
      }
      setNotice(oldFileCleanupError
        ? 'Foto salva, mas não foi possível limpar o arquivo antigo do armazenamento.'
        : (editing ? 'Trabalho atualizado com sucesso.' : 'Trabalho publicado com sucesso.'));
      resetForm();
      await load();
    } catch (e) {
      if (uploadedPath && !saved) {
        await supabase.storage.from(BUCKET).remove([uploadedPath]);
      }
      setError('Não foi possível salvar: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(photo) {
    if (!adminMode || busy) return;
    if (confirmDeleteId !== photo.id) {
      setConfirmDeleteId(photo.id);
      return;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { data, error: dbError } = await supabase.from('portfolio_photos')
        .delete().eq('id', photo.id).select('id').maybeSingle();
      if (dbError) throw dbError;
      if (!data) throw new Error('A foto já não está no portfólio. Atualize a galeria.');
      const { error: fileError } = await supabase.storage.from(BUCKET)
        .remove([photo.image_path]);
      setNotice(fileError
        ? 'Foto excluída da galeria, mas o arquivo não pôde ser removido do armazenamento.'
        : 'Trabalho excluído do portfólio.');
      if (editing?.id === photo.id) resetForm();
      setConfirmDeleteId(null);
      await load();
    } catch (e) {
      setError('Falha ao excluir: ' + (e?.message || 'erro desconhecido'));
    } finally {
      setBusy(false);
    }
  }

  async function move(photo, direction) {
    if (!adminMode || busy) return;
    const index = photos.findIndex(p => p.id === photo.id);
    const other = photos[index + direction];
    if (index < 0 || !other) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const a = Number(photo.sort_order) || 0;
      const b = Number(other.sort_order) || 0;
      if (a !== b) {
        const { error: firstError } = await supabase.from('portfolio_photos')
          .update({ sort_order: b }).eq('id', photo.id);
        if (firstError) throw firstError;
        const { error: secondError } = await supabase.from('portfolio_photos')
          .update({ sort_order: a }).eq('id', other.id);
        if (secondError) throw secondError;
      } else {
        // Normaliza índices legados com a mesma posição.
        const ordered = [...photos];
        ordered.splice(index, 1);
        ordered.splice(index + direction, 0, photo);
        for (let i = 0; i < ordered.length; i++) {
          const { error: updateError } = await supabase.from('portfolio_photos')
            .update({ sort_order: i }).eq('id', ordered[i].id);
          if (updateError) throw updateError;
        }
      }
      setNotice('Ordem do portfólio atualizada.');
      await load();
    } catch (e) {
      setError('Não foi possível alterar a ordem: ' + (e?.message || 'erro desconhecido'));
      await load();
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <View style={[s.content, adminMode && s.adminContent]}>
      <View style={s.heading}>
        <View style={{ flex: 1 }}>
          <Text style={s.headingTitle}>{adminMode ? 'Gerenciar portfólio' : 'Nosso portfólio'}</Text>
          <Text style={s.headingSubtitle}>
            {adminMode
              ? 'Publique, edite e organize as fotos dos trabalhos realizados.'
              : 'Inspire-se nos trabalhos realizados pela TR Beauty Concept.'}
          </Text>
        </View>
        <TouchableOpacity onPress={load} accessibilityRole="button"
          accessibilityLabel="Atualizar portfólio" disabled={loading || busy} style={s.refresh}>
          <Ionicons name="refresh" size={20} color={C.mocha}/>
        </TouchableOpacity>
      </View>

      {adminMode && (
        <TouchableOpacity style={s.primaryButton} onPress={newPhoto} disabled={busy}>
          <Ionicons name="add-circle-outline" size={21} color={C.white}/>
          <Text style={s.primaryButtonText}>Adicionar trabalho</Text>
        </TouchableOpacity>
      )}

      {adminMode && formVisible && (
        <View style={s.editor}>
          <Text style={s.editorTitle}>{editing ? 'Editar trabalho' : 'Novo trabalho'}</Text>
          <Text style={s.fieldLabel}>Título *</Text>
          <TextInput style={s.input} placeholder="Ex.: Unhas em gel rosé"
            maxLength={100} value={form.title}
            onChangeText={value => setForm(p => ({ ...p, title: value }))}
            editable={!busy}/>
          <Text style={s.fieldLabel}>Descrição (opcional)</Text>
          <TextInput style={[s.input, { minHeight: 88, textAlignVertical: 'top' }]}
            multiline maxLength={500} placeholder="Conte os detalhes do trabalho"
            value={form.caption}
            onChangeText={value => setForm(p => ({ ...p, caption: value }))}
            editable={!busy}/>
          <Text style={s.fieldLabel}>Serviço vinculado</Text>
          <View style={s.filterWrap}>
            {[{ id: '', name: 'Sem serviço' }, ...serviceOptions].map(opt => (
              <TouchableOpacity key={opt.id || 'none'} disabled={busy}
                onPress={() => setForm(p => ({ ...p, service_id: opt.id }))}
                style={[s.chip, form.service_id === opt.id && s.chipActive]}>
                <Text style={[s.chipText, form.service_id === opt.id && s.chipTextActive]}>
                  {opt.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={s.fieldLabel}>{editing ? 'Substituir imagem (opcional)' : 'Imagem *'}</Text>
          {Platform.OS === 'web'
            ? React.createElement('input', {
                key: fileInputKey,
                type: 'file',
                accept: inputType,
                disabled: busy,
                onChange: selectFile,
                'aria-label': 'Escolher foto do trabalho',
                style: { maxWidth: '100%', fontSize: 14, marginBottom: 12 },
              })
            : <Text style={s.help}>O envio de fotos está disponível na versão web.</Text>}
          {!!chosenFile && <Text style={s.help}>Selecionada: {chosenFile.name}</Text>}
          <Text style={s.help}>JPG, PNG ou WEBP, até 5 MB. Publique apenas fotos autorizadas.</Text>
          <View style={s.editorActions}>
            <TouchableOpacity style={[s.primaryButton, { flex: 1 }, busy && s.disabled]}
              onPress={save} disabled={busy}>
              {busy ? <ActivityIndicator color={C.white}/> :
                <Text style={s.primaryButtonText}>{editing ? 'Salvar alterações' : 'Publicar foto'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={resetForm} disabled={busy} style={s.outlineButton}>
              <Text style={s.outlineText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {!!error && <Text style={s.error}>{error}</Text>}
      {!!notice && <Text style={s.notice}>{notice}</Text>}
      {loading && <ActivityIndicator color={C.mocha} style={{ marginVertical: 30 }}/>}
      {!loading && photos.length === 0 && !error && (
        <View style={s.empty}>
          <Ionicons name="images-outline" size={42} color={C.mocha}/>
          <Text style={s.emptyTitle}>Ainda não há fotos no portfólio</Text>
          <Text style={s.emptyDetail}>
            {adminMode ? 'Clique em Adicionar trabalho para publicar a primeira foto.' :
              'Em breve, você poderá ver nossos trabalhos por aqui.'}
          </Text>
        </View>
      )}
      {!loading && photos.length > 0 && (
        <>
          <View style={s.filterWrap}>
            {availableFilters.map(opt => (
              <TouchableOpacity key={opt.id}
                style={[s.chip, filter === opt.id && s.chipActive]}
                onPress={() => setFilter(opt.id)}>
                <Text style={[s.chipText, filter === opt.id && s.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {visiblePhotos.length === 0 && (
            <Text style={s.help}>Não há fotos nessa categoria.</Text>
          )}
          <View style={s.grid}>
            {visiblePhotos.map(photo => {
              const photoIndex = photos.findIndex(p => p.id === photo.id);
              const confirming = confirmDeleteId === photo.id;
              return (
                <View key={photo.id} style={[s.photoCard, { width: wide ? '31.5%' : '48%' }]}>
                  <Image source={{ uri: getUrl(photo.image_path) }} style={s.photo} resizeMode="cover"
                    accessibilityLabel={photo.title}/>
                  <View style={s.photoInfo}>
                    <Text style={s.photoTitle} numberOfLines={2}>{photo.title}</Text>
                    <Text style={s.photoService}>{serviceName(photo.service_id)}</Text>
                    {!!photo.caption && (
                      <Text style={s.photoCaption} numberOfLines={3}>{photo.caption}</Text>
                    )}
                    {adminMode && (
                      <>
                        <View style={s.actionRow}>
                          <TouchableOpacity onPress={() => startEdit(photo)} disabled={busy}
                            accessibilityLabel={'Editar ' + photo.title}>
                            <Text style={s.actionText}>Editar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => move(photo, -1)}
                            disabled={busy || photoIndex <= 0}
                            accessibilityLabel={'Mover para cima: ' + photo.title}>
                            <Ionicons name="arrow-up-circle-outline" size={22}
                              color={photoIndex <= 0 ? '#CEC4BB' : C.mocha}/>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => move(photo, 1)}
                            disabled={busy || photoIndex >= photos.length - 1}
                            accessibilityLabel={'Mover para baixo: ' + photo.title}>
                            <Ionicons name="arrow-down-circle-outline" size={22}
                              color={photoIndex >= photos.length - 1 ? '#CEC4BB' : C.mocha}/>
                          </TouchableOpacity>
                        </View>
                        <TouchableOpacity style={s.removeButton} disabled={busy}
                          onPress={() => remove(photo)}
                          accessibilityLabel={(confirming ? 'Confirmar exclusão de ' : 'Excluir ') + photo.title}>
                          <Text style={s.removeText}>
                            {confirming ? 'Confirmar exclusão' : 'Excluir foto'}
                          </Text>
                        </TouchableOpacity>
                        {confirming && (
                          <TouchableOpacity onPress={() => setConfirmDeleteId(null)}>
                            <Text style={s.cancelDeletion}>Manter foto</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          {photos.length >= 250 && (
            <Text style={s.help}>Exibindo as 250 fotos mais recentes da galeria.</Text>
          )}
        </>
      )}
    </View>
  );
  if (adminMode) return content;
  return <ScrollView style={{ flex: 1, backgroundColor: C.bg }}
    contentContainerStyle={{ flexGrow: 1 }}>{content}</ScrollView>;
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 65, width: '100%', maxWidth: 1040, alignSelf: 'center' },
  adminContent: { paddingHorizontal: 0, paddingTop: 0, paddingBottom: 20 },
  heading: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 20 },
  headingTitle: { fontSize: 23, fontWeight: '700', color: C.ink },
  headingSubtitle: { fontSize: 13, color: C.muted, marginTop: 5, lineHeight: 20 },
  refresh: { padding: 10, borderRadius: 12, borderWidth: 1, borderColor: C.border },
  primaryButton: { flexDirection: 'row', backgroundColor: C.ink, borderRadius: 12, paddingHorizontal: 17, paddingVertical: 14, justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 18 },
  primaryButtonText: { fontWeight: '700', color: C.white, fontSize: 14 },
  disabled: { opacity: 0.6 },
  editor: { padding: 18, backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.border, marginBottom: 23 },
  editorTitle: { fontSize: 18, color: C.ink, fontWeight: '700', marginBottom: 16 },
  fieldLabel: { fontWeight: '600', fontSize: 13, color: C.ink, marginBottom: 7 },
  input: { borderWidth: 1, borderColor: C.border, paddingHorizontal: 13, paddingVertical: 12, fontSize: 15, borderRadius: 10, backgroundColor: C.white, marginBottom: 15, color: C.ink },
  filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 17 },
  chip: { borderWidth: 1, borderColor: C.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: C.white },
  chipActive: { backgroundColor: C.ink, borderColor: C.ink },
  chipText: { fontSize: 12, fontWeight: '600', color: C.mocha },
  chipTextActive: { color: C.white },
  help: { fontSize: 12, color: C.muted, marginBottom: 14 },
  editorActions: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 12 },
  outlineButton: { paddingVertical: 14, paddingHorizontal: 17, borderColor: C.border, borderWidth: 1, borderRadius: 11 },
  outlineText: { color: C.mocha, fontWeight: '700', fontSize: 13 },
  error: { color: C.error, marginBottom: 15, lineHeight: 20 },
  notice: { color: C.success, marginBottom: 15, lineHeight: 20 },
  empty: { backgroundColor: C.white, borderWidth: 1, borderColor: C.border, borderRadius: 16, alignItems: 'center', paddingVertical: 42, paddingHorizontal: 20 },
  emptyTitle: { marginTop: 15, fontSize: 17, fontWeight: '700', color: C.ink, textAlign: 'center' },
  emptyDetail: { marginTop: 7, fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 19 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 16 },
  photoCard: { borderRadius: 13, backgroundColor: C.white, overflow: 'hidden', borderColor: C.border, borderWidth: 1 },
  photo: { width: '100%', aspectRatio: 0.93, backgroundColor: C.soft },
  photoInfo: { padding: 12 },
  photoTitle: { fontSize: 14, fontWeight: '700', color: C.ink, marginBottom: 4 },
  photoService: { fontSize: 11, color: C.mocha, fontWeight: '600', marginBottom: 6 },
  photoCaption: { fontSize: 12, lineHeight: 17, color: C.muted, marginBottom: 9 },
  actionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  actionText: { fontSize: 12, color: C.mocha, fontWeight: '700' },
  removeButton: { marginTop: 12, paddingVertical: 10, backgroundColor: '#FCECED', borderRadius: 8, alignItems: 'center' },
  removeText: { fontSize: 11, color: C.error, fontWeight: '700' },
  cancelDeletion: { color: C.muted, fontSize: 11, textAlign: 'center', paddingTop: 10 },
});
