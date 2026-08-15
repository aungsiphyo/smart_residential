import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Card from '../../components/Card';
import ScreenContainer from '../../components/ScreenContainer';
import { fetchProfile, uploadProfileImage } from '../../api/profile';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { openSystemNotificationSettings } from '../../services/pushNotifications';

const READ_ONLY_FIELDS = [
  { key: 'fullname', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'room_number', label: 'Unit' },
];

function getInitials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('');
}

export default function ProfileSettingsScreen({ navigation }) {
  const { theme } = useTheme();
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(user);
  const [loading, setLoading] = useState(!user);
  const [uploading, setUploading] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const currentProfile = await fetchProfile();
      setProfile(currentProfile);
    } catch (err) {
      if (!err.sessionExpired) {
        Alert.alert(
          'Unable to load profile',
          err.message || 'Please try again.',
        );
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile]),
  );

  const selectProfileImage = async () => {
    if (uploading) return;

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        quality: 0.85,
        maxWidth: 1200,
        maxHeight: 1200,
        assetRepresentationMode: 'compatible',
      });

      if (result.didCancel) return;
      if (result.errorCode) {
        throw new Error(result.errorMessage || 'Unable to open photo library');
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) throw new Error('No image was selected');
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        throw new Error('Profile image must be 5 MB or smaller');
      }

      setUploading(true);
      const updated = await uploadProfileImage(asset);
      setProfile(current => ({ ...current, ...updated }));
      setUser(current => ({
        ...current,
        profile_image: updated.profile_image,
      }));
      Alert.alert('Profile updated', 'Your profile photo has been saved.');
    } catch (err) {
      if (!err.sessionExpired) {
        Alert.alert(
          'Unable to update photo',
          err.message || 'Please try again.',
        );
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScreenContainer
      navigation={navigation}
      topBarVariant="stack"
      title="Settings"
    >
      <ScrollView contentContainerStyle={styles.container}>
        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} />
        ) : (
          <>
            <Card>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Profile photo
              </Text>
              <View style={styles.photoSection}>
                {profile?.profile_image ? (
                  <Image
                    source={{ uri: profile.profile_image }}
                    style={styles.avatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.avatarFallback,
                      { backgroundColor: theme.primary },
                    ]}
                  >
                    <Text
                      style={[styles.avatarText, { color: theme.primaryText }]}
                    >
                      {getInitials(profile?.fullname)}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[
                    styles.photoButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={selectProfileImage}
                  disabled={uploading}
                  activeOpacity={0.85}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color={theme.primaryText} />
                  ) : (
                    <Ionicons
                      name="images-outline"
                      size={18}
                      color={theme.primaryText}
                    />
                  )}
                  <Text
                    style={[
                      styles.photoButtonText,
                      { color: theme.primaryText },
                    ]}
                  >
                    {uploading ? 'Uploading...' : 'Choose photo'}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={[styles.photoHint, { color: theme.subtext }]}>
                JPEG, PNG or WebP · Maximum 5 MB
              </Text>
            </Card>

            <Card>
              <View style={styles.readOnlyHeader}>
                <Ionicons
                  name="notifications-outline"
                  size={21}
                  color={theme.primary}
                />
                <View style={styles.headerText}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Notification alerts
                  </Text>
                  <Text style={[styles.readOnlyText, { color: theme.subtext }]}>
                    Allow Prime City notifications, sound and vibration to
                    receive important updates while the app is in the background
                    or closed.
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.settingsButton, { borderColor: theme.primary }]}
                onPress={() =>
                  openSystemNotificationSettings().catch(() =>
                    Alert.alert(
                      'Unable to open settings',
                      'Open Android Settings, then enable Prime City notifications and sound.',
                    ),
                  )
                }
              >
                <Ionicons
                  name="settings-outline"
                  size={18}
                  color={theme.primary}
                />
                <Text
                  style={[styles.settingsButtonText, { color: theme.primary }]}
                >
                  Open notification settings
                </Text>
              </TouchableOpacity>
            </Card>

            <Card>
              <View style={styles.readOnlyHeader}>
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={theme.primary}
                />
                <View style={styles.headerText}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>
                    Account information
                  </Text>
                  <Text style={[styles.readOnlyText, { color: theme.subtext }]}>
                    These details are read-only and can only be changed by an
                    administrator.
                  </Text>
                </View>
              </View>

              {READ_ONLY_FIELDS.map((field, index) => (
                <View
                  key={field.key}
                  style={[
                    styles.fieldRow,
                    index < READ_ONLY_FIELDS.length - 1 && styles.fieldDivider,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <View>
                    <Text style={[styles.fieldLabel, { color: theme.subtext }]}>
                      {field.label}
                    </Text>
                    <Text style={[styles.fieldValue, { color: theme.text }]}>
                      {profile?.[field.key] || '—'}
                    </Text>
                  </View>
                  <Ionicons
                    name="lock-closed"
                    size={14}
                    color={theme.inactive}
                  />
                </View>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40, gap: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  photoSection: { alignItems: 'center', marginTop: 18 },
  avatar: { width: 104, height: 104, borderRadius: 52, marginBottom: 16 },
  avatarFallback: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: { fontSize: 32, fontWeight: '700' },
  photoButton: {
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
  },
  photoButtonText: { fontSize: 14, fontWeight: '700' },
  photoHint: { fontSize: 12, textAlign: 'center', marginTop: 12 },
  readOnlyHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  headerText: { flex: 1 },
  readOnlyText: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 13,
  },
  fieldDivider: { borderBottomWidth: 1 },
  fieldLabel: { fontSize: 12, marginBottom: 3 },
  fieldValue: { fontSize: 15, fontWeight: '600' },
  settingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 11,
    paddingVertical: 12,
    marginTop: 16,
  },
  settingsButtonText: { fontSize: 14, fontWeight: '700' },
});
