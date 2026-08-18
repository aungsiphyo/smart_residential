import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ScreenContainer from '../../components/ScreenContainer';
import Card from '../../components/Card';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  createPlaygroundRegistration,
  fetchMyPlaygroundRegistrations,
  fetchPlaygroundConfig,
  updatePlaygroundRegistrationStatus,
} from '../../api/playground';

const DEFAULT_SLOTS = ['Morning', 'Afternoon', 'Evening'];

function defaultDate() {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function formatAmount(value) {
  return `${Number(value || 0).toLocaleString('en-US')} MMK`;
}

function formatRegistrationDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString();
}

export default function PlaygroundScreen({ navigation }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const isAdmin = ['Admin', 'Staff'].includes(user?.role);
  const [config, setConfig] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [childName, setChildName] = useState('');
  const [childAge, setChildAge] = useState('');
  const [date, setDate] = useState(defaultDate);
  const [timeSlot, setTimeSlot] = useState('Morning');
  const [paymentMethod, setPaymentMethod] = useState('Pay at desk');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState(null);

  const slots = config?.time_slots || DEFAULT_SLOTS;
  const hasPaidPrice =
    config?.pricing_configured && config.discounted_fee_mmk > 0;
  const offerText = useMemo(() => {
    if (!config?.pricing_configured)
      return 'Fee and resident discount will be confirmed by Admin.';
    if (config.resident_discount_percent > 0) {
      return `${config.resident_discount_percent}% resident-child discount applied`;
    }
    return 'Current resident-child rate';
  }, [config]);

  const loadData = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const [nextConfig, nextRegistrations] = await Promise.all([
        fetchPlaygroundConfig(),
        fetchMyPlaygroundRegistrations(),
      ]);
      setConfig(nextConfig);
      setRegistrations(
        Array.isArray(nextRegistrations) ? nextRegistrations : [],
      );
    } catch (err) {
      if (!err.sessionExpired)
        setError(err.message || 'Unable to load playground services');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const submitRegistration = async () => {
    const age = Number(childAge);
    if (!childName.trim()) {
      Alert.alert(
        'Child name required',
        'Enter the child name for this registration.',
      );
      return;
    }
    if (!Number.isInteger(age) || age < 1 || age > 17) {
      Alert.alert('Invalid age', 'Child age must be between 1 and 17.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      Alert.alert('Invalid date', 'Use the YYYY-MM-DD date format.');
      return;
    }

    setSubmitting(true);
    try {
      await createPlaygroundRegistration({
        child_name: childName.trim(),
        child_age: age,
        requested_date: date.trim(),
        time_slot: timeSlot,
        payment_method: hasPaidPrice ? paymentMethod : 'Pay at desk',
        notes: notes.trim(),
      });
      setChildName('');
      setChildAge('');
      setNotes('');
      setDate(defaultDate());
      await loadData(true);
      Alert.alert(
        'Registration submitted',
        'Admin can now review the playground booking.',
      );
    } catch (err) {
      if (!err.sessionExpired)
        Alert.alert('Unable to register', err.message || 'Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = (registration, status) => {
    Alert.alert(
      `${status} registration`,
      `Set ${registration.child_name}'s registration to ${status}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status,
          style: status === 'Cancelled' ? 'destructive' : 'default',
          onPress: async () => {
            setUpdatingId(registration._id);
            try {
              await updatePlaygroundRegistrationStatus(
                registration._id,
                status,
              );
              await loadData(true);
            } catch (err) {
              if (!err.sessionExpired) {
                Alert.alert(
                  'Unable to update registration',
                  err.message || 'Please try again.',
                );
              }
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenContainer
      navigation={navigation}
      topBarVariant="stack"
      title="Playground"
      showBottomNav
    >
      {loading && !config ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadData(true)}
              tintColor={theme.primary}
            />
          }
        >
          {error ? (
            <Card style={[styles.errorCard, { borderColor: theme.danger }]}>
              <Ionicons
                name="alert-circle-outline"
                size={20}
                color={theme.danger}
              />
              <Text style={[styles.errorText, { color: theme.text }]}>
                {error}
              </Text>
            </Card>
          ) : null}

          {!isAdmin ? (
            <Card style={[styles.offerCard, { borderColor: theme.primary }]}>
              <View
                style={[
                  styles.offerIcon,
                  { backgroundColor: theme.primary + '20' },
                ]}
              >
                <Ionicons
                  name="football-outline"
                  size={27}
                  color={theme.primary}
                />
              </View>
              <View style={styles.offerCopy}>
                <Text style={[styles.offerTitle, { color: theme.text }]}>
                  Resident children offer
                </Text>
                <Text style={[styles.offerText, { color: theme.subtext }]}>
                  {offerText}
                </Text>
                {config?.pricing_configured ? (
                  <Text style={[styles.offerPrice, { color: theme.primary }]}>
                    {formatAmount(config.discounted_fee_mmk)} per session
                  </Text>
                ) : null}
              </View>
            </Card>
          ) : null}

          {!isAdmin ? (
            <>
              <Text style={[styles.heading, { color: theme.text }]}>
                Register a child
              </Text>
              <Card>
                <Text style={[styles.label, { color: theme.subtext }]}>
                  Child name
                </Text>
                <TextInput
                  value={childName}
                  onChangeText={setChildName}
                  placeholder="Full name"
                  placeholderTextColor={theme.inactive}
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.input,
                      borderColor: theme.border,
                    },
                  ]}
                />
                <Text style={[styles.label, { color: theme.subtext }]}>
                  Age
                </Text>
                <TextInput
                  value={childAge}
                  onChangeText={setChildAge}
                  placeholder="1-17"
                  placeholderTextColor={theme.inactive}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.input,
                      borderColor: theme.border,
                    },
                  ]}
                />
                <Text style={[styles.label, { color: theme.subtext }]}>
                  Date (YYYY-MM-DD)
                </Text>
                <TextInput
                  value={date}
                  onChangeText={setDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={theme.inactive}
                  style={[
                    styles.input,
                    {
                      color: theme.text,
                      backgroundColor: theme.input,
                      borderColor: theme.border,
                    },
                  ]}
                />
                <Text style={[styles.label, { color: theme.subtext }]}>
                  Session
                </Text>
                <View style={styles.chipRow}>
                  {slots.map(slot => {
                    const selected = timeSlot === slot;
                    return (
                      <TouchableOpacity
                        key={slot}
                        onPress={() => setTimeSlot(slot)}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selected
                              ? theme.primary
                              : theme.card,
                            borderColor: selected
                              ? theme.primary
                              : theme.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            {
                              color: selected ? theme.primaryText : theme.text,
                            },
                          ]}
                        >
                          {slot}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {hasPaidPrice ? (
                  <>
                    <Text style={[styles.label, { color: theme.subtext }]}>
                      Payment method
                    </Text>
                    <View style={styles.paymentOptions}>
                      {['Pay at desk', 'RFID Wallet'].map(method => {
                        const selected = paymentMethod === method;
                        return (
                          <TouchableOpacity
                            key={method}
                            onPress={() => setPaymentMethod(method)}
                            style={[
                              styles.paymentOption,
                              {
                                borderColor: selected
                                  ? theme.primary
                                  : theme.border,
                              },
                            ]}
                          >
                            <Ionicons
                              name={
                                selected
                                  ? 'radio-button-on'
                                  : 'radio-button-off-outline'
                              }
                              size={17}
                              color={selected ? theme.primary : theme.inactive}
                            />
                            <Text
                              style={[
                                styles.paymentText,
                                { color: theme.text },
                              ]}
                            >
                              {method}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                <Text style={[styles.label, { color: theme.subtext }]}>
                  Notes (optional)
                </Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Allergies, support needs, or pickup notes"
                  placeholderTextColor={theme.inactive}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                  style={[
                    styles.input,
                    styles.notesInput,
                    {
                      color: theme.text,
                      backgroundColor: theme.input,
                      borderColor: theme.border,
                    },
                  ]}
                />
                <TouchableOpacity
                  onPress={submitRegistration}
                  disabled={submitting}
                  style={[
                    styles.submitButton,
                    { backgroundColor: theme.primary },
                    submitting && styles.disabled,
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator color={theme.primaryText} />
                  ) : (
                    <>
                      <Ionicons
                        name="calendar-outline"
                        size={19}
                        color={theme.primaryText}
                      />
                      <Text
                        style={[
                          styles.submitText,
                          { color: theme.primaryText },
                        ]}
                      >
                        Register for playground
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </Card>
            </>
          ) : null}

          <Text style={[styles.heading, { color: theme.text }]}>
            {isAdmin ? 'Resident registrations' : 'My registrations'}
          </Text>
          {registrations.length ? (
            registrations.map(item => (
              <Card key={item._id}>
                <View style={styles.registrationHeader}>
                  <View style={styles.registrationCopy}>
                    <Text
                      style={[styles.registrationName, { color: theme.text }]}
                    >
                      {item.child_name}
                    </Text>
                    {isAdmin ? (
                      <Text
                        style={[
                          styles.registrationMeta,
                          { color: theme.subtext },
                        ]}
                      >
                        {item.user_id?.fullname || 'Resident'} · Room{' '}
                        {item.room_id?.room_name || 'Unknown'}
                      </Text>
                    ) : null}
                    <Text
                      style={[
                        styles.registrationMeta,
                        { color: theme.subtext },
                      ]}
                    >
                      Age {item.child_age} ·{' '}
                      {formatRegistrationDate(item.requested_date)} ·{' '}
                      {item.time_slot}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: theme.primaryBg },
                    ]}
                  >
                    <Text style={[styles.statusText, { color: theme.primary }]}>
                      {item.status}
                    </Text>
                  </View>
                </View>
                <Text
                  style={[styles.registrationMeta, { color: theme.subtext }]}
                >
                  Payment: {item.payment_status} · {item.payment_method}
                </Text>
                <Text
                  style={[styles.registrationMeta, { color: theme.subtext }]}
                >
                  {item.pricing_status === 'Final'
                    ? `Resident price: ${formatAmount(item.amount_due_mmk)}`
                    : 'Price: Admin confirmation'}
                </Text>
                {isAdmin &&
                !['Completed', 'Cancelled'].includes(item.status) ? (
                  <View style={styles.adminActions}>
                    {['Confirmed', 'Waitlisted', 'Completed', 'Cancelled'].map(
                      status => (
                        <TouchableOpacity
                          key={status}
                          disabled={updatingId === item._id}
                          onPress={() => updateStatus(item, status)}
                          style={[
                            styles.adminAction,
                            {
                              borderColor:
                                status === 'Cancelled'
                                  ? theme.danger
                                  : theme.border,
                            },
                          ]}
                        >
                          {updatingId === item._id ? (
                            <ActivityIndicator
                              size="small"
                              color={theme.primary}
                            />
                          ) : (
                            <Text
                              style={[
                                styles.adminActionText,
                                {
                                  color:
                                    status === 'Cancelled'
                                      ? theme.danger
                                      : theme.text,
                                },
                              ]}
                            >
                              {status}
                            </Text>
                          )}
                        </TouchableOpacity>
                      ),
                    )}
                  </View>
                ) : null}
              </Card>
            ))
          ) : (
            <Card>
              <Text style={[styles.emptyText, { color: theme.subtext }]}>
                No playground registrations yet.
              </Text>
            </Card>
          )}
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 44 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorText: { flex: 1, fontSize: 13 },
  offerCard: { flexDirection: 'row', alignItems: 'center' },
  offerIcon: {
    width: 54,
    height: 54,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  offerCopy: { flex: 1 },
  offerTitle: { fontSize: 16, fontWeight: '800' },
  offerText: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  offerPrice: { fontSize: 15, fontWeight: '800', marginTop: 5 },
  heading: { fontSize: 20, fontWeight: '800', marginTop: 10, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 7, marginTop: 7 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 9,
  },
  notesInput: { minHeight: 88 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  paymentOptions: { gap: 8, marginBottom: 12 },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  paymentText: { fontSize: 14, fontWeight: '600' },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 15,
    marginTop: 7,
  },
  submitText: { fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.65 },
  registrationHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  registrationCopy: { flex: 1 },
  registrationName: { fontSize: 16, fontWeight: '800' },
  registrationMeta: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  statusBadge: {
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginLeft: 8,
  },
  statusText: { fontSize: 11, fontWeight: '800' },
  emptyText: { textAlign: 'center', fontSize: 14, paddingVertical: 12 },
  adminActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 13,
  },
  adminAction: {
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 78,
    alignItems: 'center',
  },
  adminActionText: { fontSize: 12, fontWeight: '700' },
});
