import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Card from '../../components/Card';
import ScreenContainer from '../../components/ScreenContainer';
import {
  createMonthlyBill,
  createMonthlyBillsForAll,
  fetchBillingRooms,
} from '../../api/bills';
import { useTheme } from '../../context/ThemeContext';

const ROOM_PRICES = {
  Business: 500000000,
  Office: 1000000000,
  Standard: 200000000,
  Premium: 300000000,
};
const COMMON_COMPONENTS = [
  ['electricity_amount', 'Electricity'],
  ['water_amount', 'Water'],
  ['maintenance_amount', 'Maintenance'],
  ['service_amount', 'Service fee'],
  ['other_amount', 'Other'],
];

function money(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
}

function formatMoney(value) {
  return `${money(value).toLocaleString('en-US')} MMK`;
}

function defaultDueDate() {
  const value = new Date();
  value.setDate(value.getDate() + 7);
  return value.toISOString().slice(0, 10);
}

function roomFinance(room) {
  if (!room) return null;
  const price = money(room.purchase_price) || ROOM_PRICES[room.room_type] || 0;
  const downPayment = money(room.down_payment_amount) || price * 0.4;
  const financed = money(room.financed_amount) || price - downPayment;
  const installment =
    room.installment_status === 'Paid'
      ? 0
      : money(room.monthly_installment_amount) || financed / 60;
  return { price, downPayment, financed, installment };
}

export default function CreateMonthlyBillScreen({ navigation }) {
  const { theme } = useTheme();
  const now = new Date();
  const [target, setTarget] = useState('one');
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [title, setTitle] = useState('');
  const [components, setComponents] = useState({});
  const [otherDescription, setOtherDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadRooms = useCallback(async () => {
    try {
      setRooms(await fetchBillingRooms());
    } catch (err) {
      if (!err.sessionExpired) {
        Alert.alert('Unable to load rooms', err.message || 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadRooms();
    }, [loadRooms]),
  );

  const filteredRooms = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rooms;
    return rooms.filter(room =>
      [
        room.room_name,
        room.building,
        room.room_type,
        room.resident_id?.fullname,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [rooms, search]);

  const commonTotal = useMemo(
    () =>
      COMMON_COMPONENTS.reduce((sum, [key]) => sum + money(components[key]), 0),
    [components],
  );
  const selectedFinance = useMemo(
    () => roomFinance(selectedRoom),
    [selectedRoom],
  );
  const estimatedTotal = useMemo(() => {
    if (target === 'one')
      return commonTotal + money(selectedFinance?.installment);
    return rooms.reduce(
      (sum, room) => sum + commonTotal + money(roomFinance(room)?.installment),
      0,
    );
  }, [commonTotal, rooms, selectedFinance, target]);

  const submit = async () => {
    if (target === 'one' && !selectedRoom) {
      Alert.alert(
        'Select room',
        'Choose the resident room for this monthly bill.',
      );
      return;
    }
    if (target === 'all' && !rooms.length) {
      Alert.alert(
        'No residents',
        'There are no occupied resident rooms to bill.',
      );
      return;
    }
    if (
      !(Number(month) >= 1 && Number(month) <= 12) ||
      !Number.isInteger(Number(year))
    ) {
      Alert.alert('Invalid billing period', 'Enter a valid month and year.');
      return;
    }
    if (!(estimatedTotal > 0)) {
      Alert.alert(
        'Invalid total',
        'At least one bill component must be greater than zero.',
      );
      return;
    }

    const payload = {
      billing_month: Number(month),
      billing_year: Number(year),
      ...(title.trim() ? { title: title.trim() } : {}),
      type: 'General',
      ...Object.fromEntries(
        COMMON_COMPONENTS.map(([key]) => [key, money(components[key])]),
      ),
      other_description: otherDescription.trim(),
    };

    setSubmitting(true);
    try {
      if (target === 'all') {
        const response = await createMonthlyBillsForAll(payload);
        Alert.alert(
          'Monthly bills created',
          `${response.created_count || 0} resident bills created. ${
            response.skipped_count || 0
          } existing monthly bills skipped.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      } else {
        const response = await createMonthlyBill({
          ...payload,
          room_id: selectedRoom._id,
        });
        Alert.alert(
          'Monthly bill created',
          `Room ${selectedRoom.room_name} was billed ${formatMoney(
            response.bill?.amount || estimatedTotal,
          )}.`,
          [{ text: 'OK', onPress: () => navigation.goBack() }],
        );
      }
    } catch (err) {
      if (!err.sessionExpired) {
        Alert.alert(
          'Unable to create bill',
          err.message || 'Please try again.',
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
      title="Create Monthly Bill"
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Bill recipients
          </Text>
          <View style={styles.targetRow}>
            {[
              ['one', 'One resident', 'person-outline'],
              ['all', `All residents (${rooms.length})`, 'people-outline'],
            ].map(([value, label, icon]) => {
              const selected = target === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.targetButton,
                    {
                      backgroundColor: selected ? theme.primary : theme.input,
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setTarget(value)}
                >
                  <Ionicons
                    name={icon}
                    size={18}
                    color={selected ? theme.primaryText : theme.text}
                  />
                  <Text
                    style={[
                      styles.targetText,
                      { color: selected ? theme.primaryText : theme.text },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {target === 'one' ? (
            <>
              <View
                style={[
                  styles.searchBox,
                  { backgroundColor: theme.input, borderColor: theme.border },
                ]}
              >
                <Ionicons
                  name="search-outline"
                  size={18}
                  color={theme.inactive}
                />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder="Search room, type or resident"
                  placeholderTextColor={theme.inactive}
                  value={search}
                  onChangeText={setSearch}
                />
              </View>
              {loading ? (
                <ActivityIndicator
                  color={theme.primary}
                  style={styles.loader}
                />
              ) : (
                <ScrollView style={styles.roomList} nestedScrollEnabled>
                  {filteredRooms.slice(0, 60).map(room => {
                    const selected = selectedRoom?._id === room._id;
                    return (
                      <TouchableOpacity
                        key={room._id}
                        style={[
                          styles.roomRow,
                          {
                            borderColor: selected
                              ? theme.primary
                              : theme.border,
                            backgroundColor: selected
                              ? `${theme.primary}18`
                              : theme.input,
                          },
                        ]}
                        onPress={() => setSelectedRoom(room)}
                      >
                        <Ionicons
                          name={
                            selected ? 'radio-button-on' : 'radio-button-off'
                          }
                          size={19}
                          color={selected ? theme.primary : theme.inactive}
                        />
                        <View style={styles.flex}>
                          <Text
                            style={[styles.roomName, { color: theme.text }]}
                          >
                            Room {room.room_name} · {room.room_type}
                          </Text>
                          <Text
                            style={[
                              styles.roomResident,
                              { color: theme.subtext },
                            ]}
                          >
                            {room.resident_id?.fullname || 'Resident'} ·{' '}
                            {formatMoney(roomFinance(room)?.installment)}/month
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </>
          ) : (
            <View style={[styles.infoBox, { backgroundColor: theme.input }]}>
              <Ionicons
                name="information-circle-outline"
                size={20}
                color={theme.primary}
              />
              <Text style={[styles.infoText, { color: theme.subtext }]}>
                One bill will be created for every occupied room. Existing bills
                for the same month are safely skipped.
              </Text>
            </View>
          )}
        </Card>

        {target === 'one' && selectedFinance ? (
          <Card>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Room purchase plan
            </Text>
            {[
              ['Room price', selectedFinance.price],
              ['40% paid', selectedFinance.downPayment],
              ['60% financed', selectedFinance.financed],
              ['Monthly installment (60 months)', selectedFinance.installment],
            ].map(([label, value]) => (
              <View key={label} style={styles.financeRow}>
                <Text style={[styles.financeLabel, { color: theme.subtext }]}>
                  {label}
                </Text>
                <Text style={[styles.financeValue, { color: theme.text }]}>
                  {formatMoney(value)}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Billing period
          </Text>
          <View style={styles.twoColumns}>
            <View style={styles.flex}>
              <Text style={[styles.label, { color: theme.subtext }]}>
                Month (1-12)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.input,
                    borderColor: theme.border,
                  },
                ]}
                value={month}
                onChangeText={setMonth}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.label, { color: theme.subtext }]}>Year</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.input,
                    borderColor: theme.border,
                  },
                ]}
                value={year}
                onChangeText={setYear}
                keyboardType="number-pad"
                maxLength={4}
              />
            </View>
          </View>
          <View
            style={[styles.deadlineBox, { backgroundColor: theme.warningBg }]}
          >
            <Ionicons name="time-outline" size={19} color={theme.warning} />
            <View style={styles.flex}>
              <Text style={[styles.deadlineTitle, { color: theme.text }]}>
                Due in 7 days
              </Text>
              <Text style={[styles.deadlineText, { color: theme.subtext }]}>
                Due {defaultDueDate()}. Unpaid electricity and water services
                may be suspended after this date.
              </Text>
            </View>
          </View>
          <Text style={[styles.label, { color: theme.subtext }]}>
            Custom title (optional)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: theme.text,
                backgroundColor: theme.input,
                borderColor: theme.border,
              },
            ]}
            value={title}
            onChangeText={setTitle}
            placeholder="Auto-generated when blank"
            placeholderTextColor={theme.inactive}
          />
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Bill breakdown
          </Text>
          {COMMON_COMPONENTS.map(([key, label]) => (
            <View key={key} style={styles.amountRow}>
              <Text style={[styles.componentLabel, { color: theme.text }]}>
                {label}
              </Text>
              <TextInput
                style={[
                  styles.amountInput,
                  {
                    color: theme.text,
                    backgroundColor: theme.input,
                    borderColor: theme.border,
                  },
                ]}
                value={components[key] || ''}
                onChangeText={value =>
                  setComponents(current => ({ ...current, [key]: value }))
                }
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={theme.inactive}
              />
            </View>
          ))}
          <View style={[styles.automaticRow, { backgroundColor: theme.input }]}>
            <View style={styles.flex}>
              <Text style={[styles.componentLabel, { color: theme.text }]}>
                Apartment installment
              </Text>
              <Text style={[styles.autoHint, { color: theme.subtext }]}>
                Automatic by room type
              </Text>
            </View>
            <Text style={[styles.financeValue, { color: theme.text }]}>
              {target === 'one'
                ? formatMoney(selectedFinance?.installment)
                : 'Per room'}
            </Text>
          </View>
          {money(components.other_amount) > 0 ? (
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.text,
                  backgroundColor: theme.input,
                  borderColor: theme.border,
                },
              ]}
              value={otherDescription}
              onChangeText={setOtherDescription}
              placeholder="Describe other charge"
              placeholderTextColor={theme.inactive}
              maxLength={240}
            />
          ) : null}
          <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
            <Text style={[styles.totalLabel, { color: theme.subtext }]}>
              {target === 'all'
                ? 'Estimated all-room total'
                : 'Server-verified total'}
            </Text>
            <Text style={[styles.total, { color: theme.text }]}>
              {formatMoney(estimatedTotal)}
            </Text>
          </View>
        </Card>

        <TouchableOpacity
          style={[styles.submitButton, { backgroundColor: theme.primary }]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.primaryText} />
          ) : (
            <Ionicons
              name="receipt-outline"
              size={20}
              color={theme.primaryText}
            />
          )}
          <Text style={[styles.submitText, { color: theme.primaryText }]}>
            {target === 'all'
              ? 'Create bills for all residents'
              : 'Create monthly bill'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 44, gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 14 },
  targetRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  targetButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
  },
  targetText: { fontSize: 12, fontWeight: '800' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 11,
  },
  searchInput: { flex: 1, paddingVertical: 11 },
  loader: { margin: 20 },
  roomList: { maxHeight: 290, marginTop: 10 },
  roomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 11,
    marginBottom: 7,
  },
  flex: { flex: 1 },
  roomName: { fontSize: 14, fontWeight: '700' },
  roomResident: { fontSize: 12, marginTop: 2 },
  infoBox: { flexDirection: 'row', gap: 9, padding: 12, borderRadius: 10 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  financeLabel: { flex: 1, fontSize: 12 },
  financeValue: { fontSize: 12, fontWeight: '800', textAlign: 'right' },
  twoColumns: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  deadlineBox: {
    flexDirection: 'row',
    gap: 9,
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  deadlineTitle: { fontSize: 13, fontWeight: '800' },
  deadlineText: { fontSize: 11, lineHeight: 17, marginTop: 2 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 9,
  },
  componentLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  amountInput: {
    width: 130,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    textAlign: 'right',
  },
  automaticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9,
    padding: 11,
    marginBottom: 9,
  },
  autoHint: { fontSize: 11, marginTop: 2 },
  totalRow: {
    borderTopWidth: 1,
    marginTop: 8,
    paddingTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  totalLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  total: { fontSize: 17, fontWeight: '900', textAlign: 'right' },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 15,
  },
  submitText: { fontSize: 15, fontWeight: '800' },
});
