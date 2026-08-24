import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { AppText as Text, AppTextInput as TextInput } from '../../components/AppText';
import { showPrimeAlert } from '../../services/primeAlert';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ScreenContainer from '../../components/ScreenContainer';
import Card from '../../components/Card';
import { useTheme } from '../../context/ThemeContext';
import {
  createHelperRequest,
  fetchHelperCatalog,
  HELPER_CATALOG,
} from '../../api/helpers';

const GENDER_OPTIONS = ['No Preference', 'Female', 'Male'];

export default function HelperRequestScreen({ navigation, route }) {
  const { theme } = useTheme();
  const helper = route.params?.helper;
  const initialCategory =
    route.params?.category && route.params.category !== 'All'
      ? route.params.category
      : 'House Helper';

  const [category, setCategory] = useState(initialCategory);
  const [catalog, setCatalog] = useState(HELPER_CATALOG);
  const [gender, setGender] = useState(helper?.gender || 'No Preference');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const helperSubtitle = useMemo(() => {
    if (!helper) return 'No specific helper selected';
    return [helper.gender, helper.phone].filter(Boolean).join(' · ');
  }, [helper]);
  const selectedPricing = useMemo(
    () => catalog.find(item => item.name === category),
    [catalog, category],
  );

  useEffect(() => {
    fetchHelperCatalog()
      .then(items => {
        if (Array.isArray(items) && items.length) setCatalog(items);
      })
      .catch(() => null);
  }, []);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      await createHelperRequest({
        helper_id: helper?._id,
        type: category,
        gender_preferred: gender,
        note: note.trim(),
      });

      showPrimeAlert(
        'Request sent',
        'Admin staff will review your helper request.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      if (!err.sessionExpired) {
        showPrimeAlert(
          'Request failed',
          err.message || 'Unable to request helper.',
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScreenContainer
      navigation={navigation}
      topBarVariant="stack"
      title="Helper Request"
      showBottomNav
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <View style={styles.selectedRow}>
            <View
              style={[
                styles.selectedIcon,
                { backgroundColor: theme.primary + '18' },
              ]}
            >
              <Ionicons name="people-outline" size={22} color={theme.primary} />
            </View>
            <View style={styles.selectedCopy}>
              <Text style={[styles.selectedTitle, { color: theme.text }]}>
                {helper?.fullname || 'Any available helper'}
              </Text>
              <Text style={[styles.selectedSub, { color: theme.subtext }]}>
                {helperSubtitle}
              </Text>
            </View>
          </View>
        </Card>

        <Text style={[styles.label, { color: theme.subtext }]}>Category</Text>
        <View style={styles.chipGrid}>
          {catalog.map(item => {
            const selected = category === item.name;
            return (
              <TouchableOpacity
                key={item.name}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? theme.primary : theme.card,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setCategory(item.name)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: selected ? theme.primaryText : theme.text },
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Card style={styles.pricingCard}>
          <View style={styles.pricingHeader}>
            <Ionicons name="cash-outline" size={20} color={theme.primary} />
            <Text style={[styles.pricingTitle, { color: theme.text }]}>
              Service price
            </Text>
          </View>
          {selectedPricing?.amount_mmk != null ? (
            <>
              <Text style={[styles.pricingAmount, { color: theme.primary }]}>
                {Number(selectedPricing.amount_mmk).toLocaleString('en-US')} MMK
              </Text>
              {selectedPricing.service_window ? (
                <Text style={[styles.pricingWindow, { color: theme.subtext }]}>
                  {selectedPricing.service_window}
                </Text>
              ) : null}
              <Text style={[styles.pricingNote, { color: theme.subtext }]}>
                This price is saved with your request for Admin review.
              </Text>
            </>
          ) : (
            <Text style={[styles.pricingNote, { color: theme.subtext }]}>
              Admin will confirm the price and schedule for this category.
            </Text>
          )}
        </Card>

        <Text style={[styles.label, { color: theme.subtext }]}>
          Preferred gender
        </Text>
        <View style={styles.genderRow}>
          {GENDER_OPTIONS.map(item => {
            const selected = gender === item;
            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.genderChip,
                  {
                    backgroundColor: selected
                      ? theme.primary + '20'
                      : theme.card,
                    borderColor: selected ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setGender(item)}
              >
                <Ionicons
                  name={
                    selected ? 'radio-button-on' : 'radio-button-off-outline'
                  }
                  size={16}
                  color={selected ? theme.primary : theme.inactive}
                />
                <Text style={[styles.genderText, { color: theme.text }]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.label, { color: theme.subtext }]}>Notes</Text>
        <View
          style={[
            styles.textAreaWrap,
            { backgroundColor: theme.input, borderColor: theme.border },
          ]}
        >
          <TextInput
            style={[styles.textArea, { color: theme.text }]}
            placeholder="Schedule, tasks, access notes..."
            placeholderTextColor={theme.inactive}
            value={note}
            onChangeText={setNote}
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: theme.primary },
            submitting && styles.disabled,
          ]}
          onPress={onSubmit}
          disabled={submitting}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color={theme.primaryText} />
          ) : (
            <>
              <Ionicons
                name="send-outline"
                size={18}
                color={theme.primaryText}
              />
              <Text style={[styles.submitText, { color: theme.primaryText }]}>
                Send request
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  selectedRow: { flexDirection: 'row', alignItems: 'center' },
  selectedIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  selectedCopy: { flex: 1 },
  selectedTitle: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  selectedSub: { fontSize: 13 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, marginTop: 8 },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  pricingCard: { marginBottom: 18 },
  pricingHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pricingTitle: { fontSize: 15, fontWeight: '700' },
  pricingAmount: { fontSize: 24, fontWeight: '800', marginTop: 10 },
  pricingWindow: { fontSize: 14, fontWeight: '600', marginTop: 3 },
  pricingNote: { fontSize: 13, lineHeight: 19, marginTop: 7 },
  genderRow: { gap: 8, marginBottom: 18 },
  genderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  genderText: { fontSize: 14, fontWeight: '600' },
  textAreaWrap: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  textArea: { minHeight: 110, fontSize: 15, paddingVertical: 12 },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  submitText: { fontSize: 16, fontWeight: '700' },
  disabled: { opacity: 0.7 },
});
