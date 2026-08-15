import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Card from '../../components/Card';
import ScreenContainer from '../../components/ScreenContainer';
import { fetchBill, submitBillPayment } from '../../api/bills';
import { useTheme } from '../../context/ThemeContext';

const KPAY_PHONE = '09965139303';
const SUBMITTABLE_STATUSES = new Set([
  'Pending',
  'Overdue',
  'Rejected',
  'Pending Verification',
]);

function formatAmount(value) {
  return `${Number(value || 0).toLocaleString('en-US')} MMK`;
}

export default function BillPaymentScreen({ navigation, route }) {
  const { theme } = useTheme();
  const [bill, setBill] = useState(route.params?.bill || null);
  const [screenshot, setScreenshot] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(!bill);
  const [submitting, setSubmitting] = useState(false);

  const loadBill = useCallback(async () => {
    try {
      const latest = await fetchBill(route.params?.billId || bill?._id);
      setBill(latest);
    } catch (err) {
      if (!err.sessionExpired) {
        Alert.alert('Unable to load bill', err.message || 'Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [bill?._id, route.params?.billId]);

  useFocusEffect(
    useCallback(() => {
      loadBill();
    }, [loadBill]),
  );

  const copyValue = (value, label) => {
    Clipboard.setString(String(value));
    Alert.alert('Copied', `${label} copied to clipboard.`);
  };

  const chooseScreenshot = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.9,
        maxWidth: 2000,
        maxHeight: 2000,
        assetRepresentationMode: 'compatible',
      });
      if (result.didCancel) return;
      if (result.errorCode) {
        throw new Error(result.errorMessage || 'Unable to select screenshot');
      }
      const asset = result.assets?.[0];
      if (!asset?.uri) throw new Error('No screenshot was selected');
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        throw new Error('Screenshot must be 5 MB or smaller');
      }
      setScreenshot(asset);
    } catch (err) {
      Alert.alert('Unable to select screenshot', err.message);
    }
  };

  const submitPayment = async () => {
    if (!screenshot) {
      Alert.alert(
        'Screenshot required',
        'Upload the KPay transfer screenshot first.',
      );
      return;
    }

    setSubmitting(true);
    try {
      await submitBillPayment({
        billId: bill._id,
        amount: bill.amount,
        screenshot,
        note: note.trim(),
      });
      Alert.alert(
        'Submitted for verification',
        'Your bill is not marked Paid yet. Admin must verify and approve this payment.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err) {
      if (!err.sessionExpired) {
        Alert.alert('Submission failed', err.message || 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !bill) {
    return (
      <ScreenContainer
        navigation={navigation}
        topBarVariant="stack"
        title="Pay Bill"
      >
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </ScreenContainer>
    );
  }

  const canSubmit = SUBMITTABLE_STATUSES.has(bill.status);

  return (
    <ScreenContainer
      navigation={navigation}
      topBarVariant="stack"
      title="Pay Bill"
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Card>
          <Text style={[styles.eyebrow, { color: theme.subtext }]}>
            EXACT BILL AMOUNT
          </Text>
          <Text style={[styles.amount, { color: theme.text }]}>
            {formatAmount(bill.amount)}
          </Text>
          <Text style={[styles.billTitle, { color: theme.subtext }]}>
            {bill.title}
          </Text>
          {bill.service_cutoff_warning ? (
            <View style={[styles.notice, { backgroundColor: theme.warningBg }]}>
              <Ionicons
                name="warning-outline"
                size={19}
                color={theme.warning}
              />
              <Text style={[styles.noticeText, { color: theme.text }]}>
                {bill.service_cutoff_warning}
              </Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.copyButton, { borderColor: theme.border }]}
            onPress={() => copyValue(bill.amount, 'Bill amount')}
          >
            <Ionicons name="copy-outline" size={17} color={theme.primary} />
            <Text style={[styles.copyText, { color: theme.primary }]}>
              Copy exact amount
            </Text>
          </TouchableOpacity>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            KPay transfer details
          </Text>
          <Text style={[styles.label, { color: theme.subtext }]}>
            KPay phone number
          </Text>
          <Text style={[styles.phone, { color: theme.text }]}>
            {KPAY_PHONE}
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => copyValue(KPAY_PHONE, 'KPay phone number')}
          >
            <Ionicons name="copy-outline" size={18} color={theme.primaryText} />
            <Text style={[styles.primaryText, { color: theme.primaryText }]}>
              Copy Phone Number
            </Text>
          </TouchableOpacity>
          <View style={[styles.notice, { backgroundColor: theme.warningBg }]}>
            <Ionicons
              name="shield-checkmark-outline"
              size={19}
              color={theme.warning}
            />
            <Text style={[styles.noticeText, { color: theme.text }]}>
              For safety, Prime City does not use an unverified KPay deep link.
              Open KPay manually, transfer the exact amount above, then return
              here.
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.manualButton, { borderColor: theme.border }]}
            onPress={() =>
              Alert.alert(
                'Open KPay manually',
                `Open your verified KPay application and transfer ${formatAmount(
                  bill.amount,
                )} to ${KPAY_PHONE}.`,
              )
            }
          >
            <Text style={[styles.manualText, { color: theme.text }]}>
              Manual KPay instructions
            </Text>
          </TouchableOpacity>
        </Card>

        <Card>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Payment screenshot
          </Text>
          <Text style={[styles.help, { color: theme.subtext }]}>
            Upload the completed transfer screenshot. Uploading does not mark
            the bill Paid.
          </Text>
          {screenshot ? (
            <Image
              source={{ uri: screenshot.uri }}
              style={styles.preview}
              resizeMode="cover"
            />
          ) : null}
          <TouchableOpacity
            style={[styles.uploadButton, { borderColor: theme.primary }]}
            onPress={chooseScreenshot}
            disabled={!canSubmit || submitting}
          >
            <Ionicons name="image-outline" size={20} color={theme.primary} />
            <Text style={[styles.uploadText, { color: theme.primary }]}>
              {screenshot ? 'Change screenshot' : 'Choose screenshot'}
            </Text>
          </TouchableOpacity>
          <TextInput
            style={[
              styles.noteInput,
              {
                color: theme.text,
                backgroundColor: theme.input,
                borderColor: theme.border,
              },
            ]}
            placeholder="Optional note for Admin"
            placeholderTextColor={theme.inactive}
            value={note}
            onChangeText={setNote}
            maxLength={500}
            multiline
            editable={canSubmit && !submitting}
          />
        </Card>

        {!canSubmit ? (
          <View
            style={[styles.statusNotice, { backgroundColor: theme.warningBg }]}
          >
            <Text style={[styles.statusText, { color: theme.warning }]}>
              Current status: {bill.status}
            </Text>
            <Text style={[styles.help, { color: theme.subtext }]}>
              A new screenshot cannot be submitted in this status.
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: canSubmit ? theme.primary : theme.inactive },
          ]}
          onPress={submitPayment}
          disabled={!canSubmit || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={theme.primaryText} />
          ) : (
            <Ionicons
              name="cloud-upload-outline"
              size={20}
              color={theme.primaryText}
            />
          )}
          <Text style={[styles.submitText, { color: theme.primaryText }]}>
            Submit for Admin verification
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 44, gap: 12 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  amount: { fontSize: 30, fontWeight: '900' },
  billTitle: { fontSize: 14, marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: '800', marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600' },
  phone: { fontSize: 25, fontWeight: '800', marginTop: 4, marginBottom: 14 },
  copyButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 14,
  },
  copyText: { fontSize: 13, fontWeight: '700' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 11,
  },
  primaryText: { fontSize: 15, fontWeight: '800' },
  notice: {
    flexDirection: 'row',
    gap: 9,
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  manualButton: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  manualText: { textAlign: 'center', fontSize: 13, fontWeight: '700' },
  help: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  preview: { width: '100%', height: 210, borderRadius: 11, marginBottom: 12 },
  uploadButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 11,
    padding: 13,
  },
  uploadText: { fontSize: 14, fontWeight: '700' },
  noteInput: {
    minHeight: 82,
    borderWidth: 1,
    borderRadius: 11,
    marginTop: 12,
    padding: 12,
    textAlignVertical: 'top',
  },
  statusNotice: { borderRadius: 11, padding: 13 },
  statusText: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  submitButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    padding: 15,
  },
  submitText: { fontSize: 15, fontWeight: '800' },
});
