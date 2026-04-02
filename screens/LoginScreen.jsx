// screens/LoginScreen.jsx – DeltaPlus Corporate Design
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LoginScreen = ({ navigation }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const API_URL = "https://deltaplus-check-scanner-backend.onrender.com"; // Change to your computer's IP

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (response.ok) {
        await AsyncStorage.setItem("userToken", data.access_token);
        await AsyncStorage.setItem("userName", data.full_name);
        Alert.alert("Success", "Login successful!");
        navigation.replace("AnalyzeScreen");
      } else {
        Alert.alert("Error", data.detail || "Login failed");
      }
    } catch (error) {
      Alert.alert("Error", "Could not connect to server");
    } finally {
      setLoading(false);
    }
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
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Ionicons name="person-outline" size={20} color="#F5C400" />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#9CA3AF"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed-outline" size={20} color="#F5C400" />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color="#F5C400"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#0A2A43" />
            ) : (
              <Text style={styles.loginButtonText}>Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerLink}
            onPress={() => navigation.navigate("Register")}
          >
            <Text style={styles.registerText}>
              Don't have an account?{" "}
              <Text style={styles.registerLinkText}>Register</Text>
            </Text>
          </TouchableOpacity>
        </View>
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
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 48,
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
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0A2A43",
    borderWidth: 1,
    borderColor: "#F5C400",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    marginLeft: 8,
    color: "#FFFFFF",
  },
  loginButton: {
    backgroundColor: "#F5C400",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  loginButtonText: {
    color: "#0A2A43",
    fontSize: 16,
    fontWeight: "600",
  },
  registerLink: {
    alignItems: "center",
    marginTop: 16,
  },
  registerText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  registerLinkText: {
    color: "#F5C400",
    fontWeight: "500",
  },
});

export default LoginScreen;