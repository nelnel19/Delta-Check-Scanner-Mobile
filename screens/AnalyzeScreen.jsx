// screens/AnalyzeScreen.jsx – Corporate DeltaPlus Design with CR and CR Date
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Platform,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from '@react-native-community/datetimepicker';

const { width } = Dimensions.get("window");

const AnalyzeScreen = ({ navigation }) => {
  const [image, setImage] = useState(null);
  const [result, setResult] = useState(null);
  const [displayData, setDisplayData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [token, setToken] = useState(null);
  const [userName, setUserName] = useState("");
  const [permissionStatus, setPermissionStatus] = useState({
    camera: false,
    gallery: false,
  });
  
  // Date picker states
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [currentDateField, setCurrentDateField] = useState(null);
  const [tempEditData, setTempEditData] = useState(null);
  const [editData, setEditData] = useState(null);

  const API_URL = "http://10.80.10.13:8000";

  useEffect(() => {
    checkLoginStatus();
    checkPermissions();
  }, []);

  const checkLoginStatus = async () => {
    const storedToken = await AsyncStorage.getItem("userToken");
    const storedName = await AsyncStorage.getItem("userName");
    if (!storedToken) {
      navigation.replace("Login");
    } else {
      setToken(storedToken);
      setUserName(storedName);
    }
  };

  const compressImage = async (uri) => {
    try {
      const fileInfo = await FileSystemLegacy.getInfoAsync(uri);
      if (fileInfo.size <= 800 * 1024) return uri;
      const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1024 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      return compressed.uri;
    } catch (error) {
      console.error("Compression error:", error);
      return uri;
    }
  };

  useEffect(() => {
    if (result && result.data) {
      // Initialize CR and CR Date fields if not present
      setDisplayData({
        ...result.data,
        cr: result.data.cr || "",
        cr_date: result.data.cr_date || "",
      });
    }
  }, [result]);

  const checkPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.getCameraPermissionsAsync();
    const { status: galleryStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
    setPermissionStatus({ camera: cameraStatus === "granted", gallery: galleryStatus === "granted" });
  };

  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    setPermissionStatus({ camera: cameraStatus === "granted", gallery: galleryStatus === "granted" });
    if (cameraStatus !== "granted" || galleryStatus !== "granted") {
      Alert.alert("Permissions Required", "Camera and gallery permissions are needed.");
    }
  };

  const takePhoto = async () => {
    try {
      if (!permissionStatus.camera) await requestPermissions();
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        let uri = result.assets[0].uri;
        uri = await compressImage(uri);
        setImage(uri);
        setResult(null);
        setSaved(false);
        setPreviewVisible(true);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to take photo");
    }
  };

  const pickFromGallery = async () => {
    try {
      if (!permissionStatus.gallery) await requestPermissions();
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.length) {
        let uri = result.assets[0].uri;
        uri = await compressImage(uri);
        setImage(uri);
        setResult(null);
        setSaved(false);
        setPreviewVisible(true);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const uploadImage = async () => {
    if (!image) return;
    setLoading(true);
    setPreviewVisible(false);

    const formData = new FormData();
    formData.append("file", {
      uri: image,
      name: "check.jpg",
      type: "image/jpeg",
    });

    try {
      const endpoint = debugMode ? "/scan-check-debug" : "/scan-check";
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (debugMode) {
        Alert.alert("Raw OCR Text", data.raw_text || "No text extracted");
        if (data.extracted) setResult({ data: data.extracted });
      } else {
        if (data.success) setResult(data);
        else Alert.alert("Error", data.detail || "Failed to scan check");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to connect to server.");
    } finally {
      setLoading(false);
    }
  };

  // Validate required fields before saving
  const validateRequiredFields = () => {
    if (!displayData) return false;
    
    // Required fields including CR and CR Date
    const requiredFields = ['pay_to_the_order_of', 'amount', 'date', 'check_no', 'cr', 'cr_date'];
    const missingFields = [];
    
    for (const field of requiredFields) {
      if (!displayData[field] || displayData[field].toString().trim() === '') {
        missingFields.push(field.replace(/_/g, ' ').toUpperCase());
      }
    }
    
    if (missingFields.length > 0) {
      Alert.alert(
        "Missing Required Information",
        `Please fill in the following required fields before sending:\n\n${missingFields.join('\n')}\n\nNote: CR and CR Date are required for accounting records.`,
        [{ text: "OK", onPress: () => setEditModalVisible(true) }]
      );
      return false;
    }
    
    return true;
  };

  const saveToDatabase = async () => {
    if (!image || !displayData) return;
    
    // Validate required fields before proceeding
    if (!validateRequiredFields()) {
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("image", {
        uri: image,
        name: "check.jpg",
        type: "image/jpeg",
      });
      formData.append("check_data", JSON.stringify(displayData));

      const response = await fetch(`${API_URL}/save-check`, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (response.ok && data.success) {
        Alert.alert("Success", "Check Successfully Sent to Accounting Management");
        setSaved(true);
      } else {
        Alert.alert("Error", data.detail || "Failed to save");
      }
    } catch (error) {
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setSaving(false);
    }
  };

  const resetSelection = () => {
    setImage(null);
    setResult(null);
    setDisplayData(null);
    setDebugMode(false);
    setSaved(false);
    setEditModalVisible(false);
    setTempEditData(null);
    setEditData(null);
    setShowDatePicker(false);
    setCurrentDateField(null);
  };

  // Format date to MM-DD-YYYY
  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const year = d.getFullYear();
    return `${month}-${day}-${year}`;
  };

  // Parse date from MM-DD-YYYY string
  const parseDate = (dateString) => {
    if (!dateString) return new Date();
    const parts = dateString.split('-');
    if (parts.length === 3) {
      // MM-DD-YYYY format
      return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    }
    return new Date();
  };

  // Handle date change from picker
  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    
    if (selectedDate && currentDateField && editData) {
      const formattedDate = formatDate(selectedDate);
      setEditData({ ...editData, [currentDateField]: formattedDate });
    }
    
    if (Platform.OS === 'ios') {
      setShowDatePicker(false);
    }
    
    setCurrentDateField(null);
  };

  // Open date picker for a specific field
  const openDatePicker = (fieldName) => {
    setCurrentDateField(fieldName);
    setShowDatePicker(true);
  };

  const openEditModal = () => {
    // Create a deep copy of displayData when opening the modal
    if (displayData) {
      setEditData(JSON.parse(JSON.stringify(displayData)));
      setEditModalVisible(true);
    }
  };

  const saveEditChanges = () => {
    if (editData) {
      setDisplayData(editData);
      setEditModalVisible(false);
      setEditData(null);
    }
  };

  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditData(null);
    setShowDatePicker(false);
    setCurrentDateField(null);
  };

  const renderPreviewModal = () => (
    <Modal
      animationType="slide"
      transparent
      visible={previewVisible}
      onRequestClose={() => setPreviewVisible(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Preview Check Image</Text>
          <Image source={{ uri: image }} style={styles.modalImage} resizeMode="contain" />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setPreviewVisible(false)}>
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.modalButton, styles.analyzeButton]} onPress={uploadImage} disabled={loading}>
              <Text style={styles.modalButtonText}>Analyze Check</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.debugToggle} onPress={() => setDebugMode(!debugMode)}>
            <Text style={[styles.debugText, debugMode && styles.debugOn]}>Debug Mode: {debugMode ? "ON" : "OFF"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderResult = () => {
    if (!displayData) return null;

    // Check if required fields are filled (including CR and CR Date)
    const requiredFields = ['pay_to_the_order_of', 'amount', 'date', 'check_no', 'cr', 'cr_date'];
    const hasMissingFields = requiredFields.some(field => !displayData[field] || displayData[field].toString().trim() === '');

    return (
      <ScrollView style={styles.resultContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.resultHeader}>
          <Ionicons name="document-text-outline" size={28} color="#F5C400" />
          <Text style={styles.resultTitle}>Extracted Information</Text>
        </View>

        {Object.entries(displayData).map(([key, value]) => {
          const isRequired = requiredFields.includes(key);
          const isEmpty = !value || value.toString().trim() === '';
          
          return (
            <View key={key} style={[styles.resultCard, isRequired && isEmpty && styles.missingFieldCard]}>
              <View style={styles.fieldLabelContainer}>
                <Text style={styles.fieldLabel}>{key.replace(/_/g, ' ').toUpperCase()}</Text>
                {isRequired && <Text style={styles.requiredStar}>*</Text>}
              </View>
              <Text style={[styles.fieldValue, key === 'amount' && styles.amount, key === 'check_no' && styles.highlight, isEmpty && styles.missingFieldValue]}>
                {value || "—"}
              </Text>
            </View>
          );
        })}

        {hasMissingFields && (
          <View style={styles.warningCard}>
            <Ionicons name="alert-circle-outline" size={20} color="#F5C400" />
            <Text style={styles.warningText}>
              Required fields are missing. Please edit the details before sending.
            </Text>
          </View>
        )}

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity style={styles.primaryActionButton} onPress={resetSelection}>
            <Ionicons name="scan-outline" size={20} color="#0A2A43" />
            <Text style={styles.primaryActionText}>New Scan</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryActionButton} onPress={openEditModal}>
            <Ionicons name="create-outline" size={20} color="#F5C400" />
            <Text style={styles.secondaryActionText}>Edit</Text>
          </TouchableOpacity>

          {!saved && (
            <TouchableOpacity
              style={[styles.primaryActionButton, (saving || hasMissingFields) && styles.disabledButton]}
              onPress={saveToDatabase}
              disabled={saving || hasMissingFields}
            >
              <Ionicons name="cloud-upload-outline" size={20} color="#0A2A43" />
              <Text style={styles.primaryActionText}>{saving ? "Saving..." : "Send"}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Image
            source={require("../assets/deltaplus.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>DELTAPLUS</Text>
          <Text style={styles.subtitle}>Check Scanner</Text>
          {userName ? (
            <Text style={styles.welcomeText}>Welcome, {userName}</Text>
          ) : null}
        </View>

        {!image && !result && (
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.primaryButton} onPress={takePhoto}>
              <Ionicons name="camera-outline" size={24} color="#0A2A43" />
              <Text style={styles.primaryButtonText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={pickFromGallery}>
              <Ionicons name="image-outline" size={24} color="#F5C400" />
              <Text style={styles.secondaryButtonText}>Choose from Gallery</Text>
            </TouchableOpacity>
          </View>
        )}

        {image && !result && (
          <View style={styles.previewContainer}>
            <Image source={{ uri: image }} style={styles.previewImage} />
            <TouchableOpacity style={styles.primaryButton} onPress={() => setPreviewVisible(true)} disabled={loading}>
              <Ionicons name="scan-outline" size={20} color="#0A2A43" />
              <Text style={styles.primaryButtonText}>Analyze Check</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.textButton} onPress={resetSelection}>
              <Text style={styles.textButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F5C400" />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}

        {result && renderResult()}
        {renderPreviewModal()}
        
        {/* Edit Modal */}
        <Modal
          visible={editModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={closeEditModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.editModalContent}>
              <Text style={styles.modalTitle}>Edit Check Details</Text>
              <Text style={styles.modalSubtitle}>* Required fields must be filled (including CR and CR Date)</Text>
              <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                {editData && Object.keys(editData).map((key) => {
                  const dateFields = ['date', 'cr_date', 'received_date', 'date_deposited'];
                  const requiredFields = ['pay_to_the_order_of', 'amount', 'date', 'check_no', 'cr', 'cr_date'];
                  const isDateField = dateFields.includes(key);
                  const isRequired = requiredFields.includes(key);
                  
                  return (
                    <View key={key} style={styles.editField}>
                      <View style={styles.editLabelContainer}>
                        <Text style={styles.editLabel}>
                          {key.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                        {isRequired && (
                          <Text style={styles.requiredStar}>*</Text>
                        )}
                      </View>
                      
                      {isDateField ? (
                        <TouchableOpacity
                          style={styles.datePickerButton}
                          onPress={() => openDatePicker(key)}
                        >
                          <Text style={[styles.editInput, styles.dateInputText]}>
                            {editData[key] || "Select Date"}
                          </Text>
                          <Ionicons name="calendar-outline" size={20} color="#F5C400" />
                        </TouchableOpacity>
                      ) : (
                        <TextInput
                          style={styles.editInput}
                          value={editData[key] || ''}
                          onChangeText={(text) => setEditData({ ...editData, [key]: text })}
                          placeholder={`Enter ${key.replace(/_/g, ' ')}`}
                          placeholderTextColor="#9CA3AF"
                          multiline={key === 'pay_to_the_order_of' || key === 'account_name'}
                        />
                      )}
                    </View>
                  );
                })}
              </ScrollView>
              <View style={styles.editModalButtons}>
                <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={closeEditModal}>
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={saveEditChanges}>
                  <Text style={styles.modalButtonText}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
        
        {/* Date Picker */}
        {showDatePicker && (
          <View style={styles.datePickerOverlay}>
            <View style={styles.datePickerContainer}>
              <View style={styles.datePickerHeader}>
                <Text style={styles.datePickerTitle}>Select Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                  <Ionicons name="close" size={24} color="#F5C400" />
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={editData && currentDateField ? parseDate(editData[currentDateField]) : new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onDateChange}
                themeVariant="dark"
              />
              {Platform.OS === 'android' && (
                <TouchableOpacity 
                  style={styles.datePickerConfirmButton}
                  onPress={() => setShowDatePicker(false)}
                >
                  <Text style={styles.datePickerConfirmText}>Confirm</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
    marginTop: 16,
  },
  logo: {
    width: 88,
    height: 88,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#F5C400",
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: "#FFFFFF",
    marginTop: 4,
    opacity: 0.7,
    fontWeight: "400",
  },
  welcomeText: {
    fontSize: 14,
    color: "#F5C400",
    marginTop: 12,
    fontWeight: "500",
  },
  buttonContainer: {
    gap: 16,
    marginTop: 24,
  },
  primaryButton: {
    backgroundColor: "#F5C400",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A2A43",
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#F5C400",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#F5C400",
  },
  previewContainer: {
    alignItems: "center",
    marginTop: 16,
  },
  previewImage: {
    width: "100%",
    height: 280,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2C3E50",
    backgroundColor: "#0A2A43",
    marginBottom: 20,
  },
  textButton: {
    marginTop: 12,
    paddingVertical: 8,
  },
  textButtonText: {
    color: "#F5C400",
    fontSize: 14,
    fontWeight: "500",
  },
  loadingContainer: {
    alignItems: "center",
    marginTop: 48,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
    marginTop: 12,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
  },
  modalContent: {
    backgroundColor: "#0A2A43",
    borderRadius: 24,
    padding: 24,
    width: width * 0.9,
    alignItems: "center",
    maxHeight: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
    color: "#F5C400",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#FFFFFF",
    marginBottom: 16,
    opacity: 0.7,
  },
  modalImage: {
    width: "100%",
    height: 280,
    borderRadius: 12,
    marginBottom: 20,
    backgroundColor: "#1E3A5F",
  },
  modalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 40,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#2C4A6E",
  },
  analyzeButton: {
    backgroundColor: "#F5C400",
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  debugToggle: {
    marginTop: 20,
    paddingVertical: 8,
  },
  debugText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
  },
  debugOn: {
    color: "#F5C400",
  },
  resultContainer: {
    flex: 1,
    marginTop: 16,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 8,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  resultCard: {
    backgroundColor: "#0A2A43",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#1E3A5F",
  },
  missingFieldCard: {
    borderColor: "#F5C400",
    borderWidth: 1.5,
  },
  fieldLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  fieldLabel: {
    fontSize: 12,
    color: "#F5C400",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  requiredStar: {
    color: "#F5C400",
    fontSize: 12,
    fontWeight: "bold",
    marginLeft: 4,
  },
  fieldValue: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "400",
  },
  missingFieldValue: {
    color: "#F5C400",
    fontStyle: "italic",
  },
  highlight: {
    color: "#F5C400",
    fontWeight: "600",
    fontSize: 18,
  },
  amount: {
    color: "#F5C400",
    fontWeight: "600",
    fontSize: 18,
  },
  warningCard: {
    backgroundColor: "rgba(245, 196, 0, 0.1)",
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#F5C400",
  },
  warningText: {
    color: "#F5C400",
    fontSize: 12,
    flex: 1,
  },
  actionButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 24,
    marginBottom: 32,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: "#F5C400",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 40,
    gap: 8,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  primaryActionText: {
    color: "#0A2A43",
    fontSize: 16,
    fontWeight: "600",
  },
  secondaryActionButton: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#F5C400",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 40,
    gap: 8,
  },
  secondaryActionText: {
    color: "#F5C400",
    fontSize: 16,
    fontWeight: "500",
  },
  disabledButton: {
    opacity: 0.6,
  },
  editModalContent: {
    backgroundColor: "#0A2A43",
    borderRadius: 24,
    padding: 24,
    width: width * 0.9,
    maxHeight: "80%",
    alignItems: "center",
  },
  editField: {
    width: "100%",
    marginBottom: 16,
  },
  editLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  editLabel: {
    fontSize: 12,
    color: "#F5C400",
    fontWeight: "500",
    letterSpacing: 0.5,
  },
  editInput: {
    borderWidth: 1,
    borderColor: "#1E3A5F",
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#1E3A5F",
    color: "#FFFFFF",
  },
  datePickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#1E3A5F",
    borderRadius: 12,
    backgroundColor: "#1E3A5F",
    paddingRight: 12,
  },
  dateInputText: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: "#FFFFFF",
  },
  editModalButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    gap: 12,
    marginTop: 16,
  },
  saveButton: {
    backgroundColor: "#F5C400",
  },
  datePickerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  datePickerContainer: {
    backgroundColor: '#0A2A43',
    borderRadius: 24,
    padding: 20,
    width: width * 0.9,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F5C400',
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F5C400',
  },
  datePickerConfirmButton: {
    backgroundColor: '#F5C400',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 20,
    width: '100%',
    alignItems: 'center',
  },
  datePickerConfirmText: {
    color: '#0A2A43',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default AnalyzeScreen;