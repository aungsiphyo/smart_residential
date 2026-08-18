import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ScreenContainer from '../../components/ScreenContainer';
import Card from '../../components/Card';
import { useTheme } from '../../context/ThemeContext';
import { fetchVisitorPass } from '../../api/visitors';

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export default function VisitorPassScreen({ navigation, route }) {
  const { theme } = useTheme();
  const initial = route.params?.initialPass || null;
  const visitorId = route.params?.visitorId || initial?.id;
  const [data, setData] = useState(initial);
  const [loading, setLoading] = useState(!initial);
  const [sharing, setSharing] = useState(false);

  const load = useCallback(async () => {
    if (!visitorId || initial) return;
    setLoading(true);
    try {
      setData(await fetchVisitorPass(visitorId));
    } catch (error) {
      if (!error.sessionExpired) {
        Alert.alert('Unable to load visitor pass', error.message);
      }
    } finally {
      setLoading(false);
    }
  }, [initial, visitorId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const pass = data?.visitor_pass;
  const imageData = pass?.qr_image_data_url;
  const active = pass?.status === 'Active' && Boolean(imageData);

  const sharePass = async () => {
    if (!imageData) return;
    setSharing(true);
    try {
      const base64 = imageData.replace(/^data:image\/png;base64,/, '');
      const safeBadge = String(data?.badgeNumber || 'visitor').replace(
        /[^A-Za-z0-9_-]/g,
        '-',
      );
      const path = `${RNFS.CachesDirectoryPath}/prime-city-${safeBadge}.png`;
      await RNFS.writeFile(path, base64, 'base64');
      await Share.share({
        title: 'Prime City visitor pass',
        message: `Prime City visitor pass for ${data?.name || 'visitor'} · ${
          data?.badgeNumber || ''
        }. Show this QR at the gate on ${formatDate(data?.visitDate)}. ${
          pass?.share_url || ''
        }`,
        url: `file://${path}`,
      });
    } catch (_error) {
      Alert.alert(
        'Unable to share',
        'Please take a screenshot of the QR pass and share it manually.',
      );
    } finally {
      setSharing(false);
    }
  };

  return (
    <ScreenContainer
      navigation={navigation}
      topBarVariant="stack"
      title="Visitor QR Pass"
      showBottomNav
    >
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <View style={styles.container}>
          <Card>
            <View style={styles.headerRow}>
              <View style={styles.copy}>
                <Text style={[styles.name, { color: theme.text }]}>
                  {data?.name || 'Visitor'}
                </Text>
                <Text style={[styles.meta, { color: theme.subtext }]}>
                  {data?.badgeNumber || 'Badge pending'} · Room{' '}
                  {data?.room || 'assigned resident room'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: active ? theme.successBg : theme.warningBg,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    { color: active ? theme.success : theme.warning },
                  ]}
                >
                  {pass?.status || data?.qr_status || 'Unavailable'}
                </Text>
              </View>
            </View>

            {active ? (
              <View style={styles.qrWrap}>
                <Image source={{ uri: imageData }} style={styles.qrImage} />
              </View>
            ) : (
              <View
                style={[
                  styles.unavailable,
                  { backgroundColor: theme.warningBg },
                ]}
              >
                <Ionicons
                  name="shield-outline"
                  size={24}
                  color={theme.warning}
                />
                <Text style={[styles.instructions, { color: theme.text }]}>
                  This pass is no longer active. Used, expired, or revoked
                  passes cannot be scanned again.
                </Text>
              </View>
            )}

            <Text style={[styles.label, { color: theme.subtext }]}>
              VALID FOR
            </Text>
            <Text style={[styles.value, { color: theme.text }]}>
              {formatDate(pass?.valid_from || data?.visitDate)} –{' '}
              {formatDate(pass?.expires_at)}
            </Text>
            <Text style={[styles.label, { color: theme.subtext }]}>
              PURPOSE
            </Text>
            <Text style={[styles.value, { color: theme.text }]}>
              {data?.purpose || 'General'}
            </Text>
          </Card>

          <Card>
            <Text style={[styles.instructions, { color: theme.text }]}>
              Send this pass to your visitor. At the gate, show it to the
              ESP32-CAM. The reception display will verify it and show the
              approved visitor details automatically.
            </Text>
            <Text style={[styles.privacy, { color: theme.subtext }]}>
              The QR contains a signed one-time token—not phone, email, NRIC, or
              private resident profile data.
            </Text>
          </Card>

          {active ? (
            <TouchableOpacity
              onPress={sharePass}
              disabled={sharing}
              style={[styles.button, { backgroundColor: theme.primary }]}
            >
              {sharing ? (
                <ActivityIndicator color={theme.primaryText} />
              ) : (
                <>
                  <Ionicons
                    name="share-social-outline"
                    size={20}
                    color={theme.primaryText}
                  />
                  <Text
                    style={[styles.buttonText, { color: theme.primaryText }]}
                  >
                    Save or share QR pass
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  copy: { flex: 1 },
  name: { fontSize: 22, fontWeight: '800' },
  meta: { fontSize: 13, marginTop: 5 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  statusText: { fontWeight: '800' },
  qrWrap: { alignItems: 'center', marginVertical: 20 },
  qrImage: { width: 270, height: 270, borderRadius: 12 },
  unavailable: {
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    gap: 10,
    marginVertical: 18,
  },
  label: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, marginTop: 12 },
  value: { fontSize: 14, marginTop: 4 },
  instructions: { flex: 1, fontSize: 14, lineHeight: 21 },
  privacy: { fontSize: 12, lineHeight: 18, marginTop: 10 },
  button: {
    borderRadius: 12,
    padding: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: { fontSize: 15, fontWeight: '800' },
});
